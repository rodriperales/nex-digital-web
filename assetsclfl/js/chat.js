(function(){
  "use strict";

  if(window.__NEX_PUBLIC_CHAT_INIT__){
    return;
  }
  window.__NEX_PUBLIC_CHAT_INIT__ = true;

  const CHAT_API_URL = "https://nex-digital-chat.tsmcorcoles.workers.dev";
  const CHAT_REQUEST_TIMEOUT_MS = 20000;
  const CHAT_MAX_MESSAGE_CHARS = 600;
  const CHAT_COOLDOWN_MS = 1800;
  const CHAT_MAX_TURNS_PER_SESSION = 20;
  const CHAT_SESSION_KEY = "nex_public_chat_session_id";
  const CHAT_TURNS_KEY = "nex_public_chat_turns";

  const chatToggle = document.getElementById("chatToggle");
  const chatPanel = document.getElementById("chatPanel");
  const chatClose = document.getElementById("chatClose");
  const chatMessages = document.getElementById("chatMessages");
  const chatForm = document.getElementById("chatForm");
  const chatInput = document.getElementById("chatInput");
  const chatSend = document.getElementById("chatSend");

  if(!chatToggle || !chatPanel || !chatMessages || !chatForm || !chatInput || !chatSend){
    return;
  }

  let chatBooted = false;
  let lastMessageAt = 0;

  function safeSessionGet(key){
    try{
      return window.sessionStorage.getItem(key);
    }catch(_){
      return null;
    }
  }

  function safeSessionSet(key,value){
    try{
      window.sessionStorage.setItem(key,value);
    }catch(_){
      // ignore storage errors
    }
  }

  function getSessionId(){
    const existing = safeSessionGet(CHAT_SESSION_KEY);
    if(existing){
      return existing;
    }
    const nextId =
      (window.crypto && typeof window.crypto.randomUUID === "function")
        ? window.crypto.randomUUID()
        : `chat-${Date.now()}-${Math.random().toString(16).slice(2)}`;
    safeSessionSet(CHAT_SESSION_KEY,nextId);
    return nextId;
  }

  function getTurnCount(){
    const raw = safeSessionGet(CHAT_TURNS_KEY);
    const parsed = Number(raw);
    return Number.isFinite(parsed) && parsed >= 0 ? parsed : 0;
  }

  function incrementTurnCount(){
    const next = getTurnCount() + 1;
    safeSessionSet(CHAT_TURNS_KEY,String(next));
    return next;
  }

  function appendMessage(role,text){
    const node = document.createElement("div");
    node.className = `chat-msg ${role}`;
    node.textContent = text;
    chatMessages.appendChild(node);
    chatMessages.scrollTop = chatMessages.scrollHeight;
  }

  function clearTypingBubble(){
    const typingBubble = chatMessages.querySelector(".chat-msg.bot:last-child");
    if(typingBubble && typingBubble.textContent === "Escribiendo..."){
      typingBubble.remove();
    }
  }

  function setComposerEnabled(enabled){
    chatInput.disabled = !enabled;
    chatSend.disabled = !enabled;
    if(enabled){
      chatInput.focus();
    }
  }

  function setChatOpenState(isOpen){
    chatPanel.hidden = !isOpen;
    chatToggle.setAttribute("aria-expanded", isOpen ? "true" : "false");
  }

  function bootChatOnce(){
    if(chatBooted){
      return;
    }
    chatBooted = true;
    appendMessage(
      "bot",
      "Hola. Soy el asistente publico de preventa. Puedo orientarte sobre servicios, proceso de trabajo y siguientes pasos."
    );
  }

  function openChat(){
    setChatOpenState(true);
    bootChatOnce();
    setTimeout(() => chatInput.focus(), 50);
  }

  function closeChat(){
    setChatOpenState(false);
  }

  function normalizeMessage(raw){
    return String(raw || "").replace(/\s+/g," ").trim();
  }

  function buildPublicErrorMessage(error){
    const code = String(error?.code || "").toUpperCase();
    if(code === "COOLDOWN"){
      return "Espera un par de segundos antes de enviar otra consulta.";
    }
    if(code === "LIMIT"){
      return "Has alcanzado el limite de mensajes de esta sesion. Para continuar, usa el formulario principal.";
    }
    if(code === "TOO_LONG"){
      return `Tu mensaje es demasiado largo. Limitalo a ${CHAT_MAX_MESSAGE_CHARS} caracteres.`;
    }
    if(code === "TIMEOUT"){
      return "El asistente ha tardado demasiado en responder. Reintenta en unos segundos.";
    }
    return "No pude responder en este intento. Reintenta o usa el formulario principal para una revision personalizada.";
  }

  function safeJsonParse(rawText){
    if(!rawText){
      return null;
    }
    try{
      return JSON.parse(rawText);
    }catch(_){
      return null;
    }
  }

  function extractReply(payload,rawText){
    if(payload && typeof payload === "object"){
      const direct = payload.reply || payload.response || payload.answer || payload.text;
      if(typeof direct === "string" && direct.trim()){
        return direct.trim();
      }
    }
    if(typeof rawText === "string" && rawText.trim()){
      return rawText.trim();
    }
    return "";
  }

  function buildErrorFromResponse(status,payload,rawText){
    const error = new Error("Chat request failed");
    error.code =
      payload?.errorCode ||
      payload?.code ||
      `HTTP_${status}`;
    error.detail =
      payload?.error ||
      payload?.message ||
      payload?.detail ||
      (typeof rawText === "string" ? rawText.slice(0,220) : "");
    return error;
  }

  async function sendMessageToWorker(message){
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), CHAT_REQUEST_TIMEOUT_MS);
    let response;
    let rawText = "";

    try{
      response = await fetch(CHAT_API_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Accept": "application/json"
        },
        body: JSON.stringify({
          message,
          sessionId: getSessionId(),
          channel: "public-web-chat"
        }),
        signal: controller.signal
      });
      rawText = await response.text();
    }catch(error){
      const networkError = new Error("Network error");
      networkError.code = error?.name === "AbortError" ? "TIMEOUT" : "NETWORK";
      networkError.detail = String(error?.message || error || "");
      throw networkError;
    }finally{
      clearTimeout(timeoutId);
    }

    const payload = safeJsonParse(rawText);

    if(!response.ok){
      throw buildErrorFromResponse(response.status,payload,rawText);
    }

    const reply = extractReply(payload,rawText);
    if(!reply){
      const emptyError = new Error("Empty reply");
      emptyError.code = "EMPTY_REPLY";
      throw emptyError;
    }

    return reply.length > 1200 ? `${reply.slice(0,1200)}...` : reply;
  }

  chatToggle.addEventListener("click", () => {
    if(chatPanel.hidden){
      openChat();
      return;
    }
    closeChat();
  });

  chatClose?.addEventListener("click", closeChat);

  chatForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    const now = Date.now();
    if(now - lastMessageAt < CHAT_COOLDOWN_MS){
      appendMessage("bot",buildPublicErrorMessage({ code: "COOLDOWN" }));
      return;
    }

    const turns = getTurnCount();
    if(turns >= CHAT_MAX_TURNS_PER_SESSION){
      appendMessage("bot",buildPublicErrorMessage({ code: "LIMIT" }));
      return;
    }

    const message = normalizeMessage(chatInput.value);
    if(!message){
      return;
    }
    if(message.length > CHAT_MAX_MESSAGE_CHARS){
      appendMessage("bot",buildPublicErrorMessage({ code: "TOO_LONG" }));
      return;
    }

    lastMessageAt = now;
    incrementTurnCount();

    appendMessage("user", message);
    chatInput.value = "";
    setComposerEnabled(false);
    appendMessage("bot", "Escribiendo...");

    try{
      const reply = await sendMessageToWorker(message);
      clearTypingBubble();
      appendMessage("bot", reply);
    }catch(error){
      clearTypingBubble();
      appendMessage("bot", buildPublicErrorMessage(error));
      console.error("[PublicChat]", {
        code: error?.code || "UNKNOWN",
        detail: error?.detail || String(error?.message || error || "")
      });
    }finally{
      setComposerEnabled(true);
    }
  });
})();

(function(){
  'use strict';

  function normalize(value){
    return String(value||'')
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g,'')
      .trim();
  }

  function buildSearchText(item){
    var keywords=Array.isArray(item.keywords)?item.keywords.join(' '):'';
    return normalize([item.question,item.answer,item.category,keywords].join(' '));
  }

  function createFaqNode(item){
    var details=document.createElement('details');
    details.className='faq-item';
    var summary=document.createElement('summary');
    var answer=document.createElement('p');
    summary.textContent=item.question||'';
    answer.textContent=item.answer||'';
    details.appendChild(summary);
    details.appendChild(answer);
    return details;
  }

  function extractFallbackFaq(grid){
    return Array.from(grid.querySelectorAll('details')).map(function(node,index){
      var summary=node.querySelector('summary');
      var p=node.querySelector('p');
      return {
        id:'dom-'+index,
        question:summary?summary.textContent.trim():'',
        answer:p?p.textContent.trim():'',
        category:'general',
        keywords:[]
      };
    });
  }

  document.addEventListener('DOMContentLoaded',function(){
    var faqGrid=document.getElementById('faqGrid');
    var searchInput=document.getElementById('faqSearchInput');
    var searchMeta=document.getElementById('faqSearchMeta');
    var noResults=document.getElementById('faqNoResults');
    if(!faqGrid||!searchInput||!searchMeta||!noResults) return;

    var faqItems=extractFallbackFaq(faqGrid);

    function render(items){
      faqGrid.innerHTML='';
      items.forEach(function(item){
        faqGrid.appendChild(createFaqNode(item));
      });
      noResults.classList.toggle('show',items.length===0);
      if(items.length===0){
        searchMeta.textContent='Sin coincidencias. Prueba con otra palabra clave.';
      }else{
        searchMeta.textContent=items.length+' respuesta'+(items.length===1?'':'s')+' encontrada'+(items.length===1?'':'s')+'.';
      }
    }

    function applyFilter(rawQuery){
      var query=normalize(rawQuery);
      if(!query){
        render(faqItems);
        searchMeta.textContent='Escribe una palabra clave para filtrar respuestas.';
        return;
      }
      var filtered=faqItems.filter(function(item){
        return buildSearchText(item).indexOf(query)!==-1;
      });
      render(filtered);
    }

    searchInput.addEventListener('input',function(e){
      applyFilter(e.target.value);
    });

    fetch('/data/faq.json',{cache:'no-store'})
      .then(function(res){
        if(!res.ok) throw new Error('faq.json no disponible');
        return res.json();
      })
      .then(function(data){
        if(Array.isArray(data)&&data.length){
          faqItems=data;
          applyFilter('');
        }
      })
      .catch(function(){
        applyFilter('');
      });
  });
})();

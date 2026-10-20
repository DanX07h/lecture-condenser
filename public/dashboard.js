export function setupDashboard(){
  const names={dashboard:'Overview',lectures:'Lecture notes',slides:'Slide decks',reader:'Notes reader',library:'Folders & notes',flashcards:'Flashcards'};
  function render(){
    const requested=window.location.hash.slice(1);
    const view=Object.hasOwn(names,requested)?requested:'dashboard';
    for(const panel of document.querySelectorAll('[data-panel]'))panel.hidden=panel.dataset.panel!==view;
    for(const link of document.querySelectorAll('[data-nav]')){
      if(link.dataset.nav===view)link.setAttribute('aria-current','page');else link.removeAttribute('aria-current');
    }
    document.getElementById('current-page').textContent=names[view];
    document.title=`${names[view]} · Lecture Condenser`;
    document.getElementById('create-flashcard').hidden=view!=='reader';
    // Keep a single reading workspace and preserve forms and unsaved notes across navigation.
    const main=document.getElementById('main-content');main.scrollTop=0;
  }
  function navigate(view){
    if(!Object.hasOwn(names,view))view='dashboard';
    if(window.location.hash==='#'+view)render();else {window.location.hash=view;render();}
  }
  window.addEventListener('hashchange',render);
  render();
  return {navigate};
}

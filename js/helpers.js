(() => {
  const src = new URL('../core/helpers.js', document.currentScript.src).href;
  const script = document.createElement('script');
  script.src = src;
  script.defer = true;
  document.head.appendChild(script);
})();

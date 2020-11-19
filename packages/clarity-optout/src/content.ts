((): void => {
    const script = document.createElement("script");
    script.type = "text/javascript";
    script.innerText = `(function(c,l,a,r,i,t,y){c.coptout=!0;c[l]=c[l]||function(){(c[l].q=c[l].q||[]).push(arguments)};c[l]('optout');})(window, "clarity");`;
    document.documentElement.insertBefore(script, document.documentElement.firstChild);
})();

var evergreen = require('@bhaze31/evergreenjs');

window.onload = function() {
    var processor = new evergreen.EvergreenProcessor([]);
    var converter = new evergreen.EvergreenConverter([]);
    var content = document.getElementById('content');
    var styles = document.getElementById('styles');
    var markdownArea = document.getElementById('markdown');

    var convertTextAreaToMarkdown = function() {
        var markdownText = content.value;
        var data = processor.updateLines(markdownText.split('\n')).parse();
        converter.updateData(data).convert(markdownArea);
    }

    var updateStyles = function () {
      var style = document.createElement('style');
      style.type = 'text/css';
      style.innerText = styles.value;
      var head = document.getElementsByTagName('head')[0]
      head.lastElementChild.remove();
      head.appendChild(style);
    }

    content.addEventListener('input', convertTextAreaToMarkdown);
    styles.addEventListener('input', updateStyles);
    convertTextAreaToMarkdown();
    updateStyles();
};

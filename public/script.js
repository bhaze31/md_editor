class MDConverter {
  getHeader(innerText, headerType) {
    if (headerType > 6) {
      headerType = 6;
    }
    const header = document.createElement(`h${headerType}`);
    header.innerText = innerText;
    return header
  }

  getParagraph(innerText) {
    const paragraph = document.createElement('p');
    paragraph.innerText = innerText;
    return paragraph;
  }

  getHtmlElement(text) {
    const trimmed = text.trim();
    if (trimmed.startsWith('#')) {
      const headerRegex = new RegExp('^#+');
      const headerLength = headerRegex.exec(trimmed)[0].length
      const headerText = trimmed.substring(headerLength).trim();
      return this.getHeader(headerText, headerLength);
    } else {
      // Assume it is a paragraph
      return this.getParagraph(trimmed);
    }
  }

  getHtml(text) {
    const split = text.split('\n');
    const elements = split.map((line) => {
      return this.getHtmlElement(line).outerHTML;
    });
    return elements.join('');
  }
}

window.onload = function() {
    var converter = new MDConverter();

    var pad = document.getElementById('pad');
    var markdownArea = document.getElementById('markdown');

    var convertTextAreaToMarkdown = function() {
        var markdownText = pad.value;
        html = converter.getHtml(markdownText);
        markdownArea.innerHTML = html;
    }

    pad.addEventListener('input', convertTextAreaToMarkdown);

    convertTextAreaToMarkdown();
};

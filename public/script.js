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

  getHtmlTextElement(text) {
    const trimmed = text.trim();
    if (trimmed.startsWith('#')) {
      const headerRegex = new RegExp('^#+');
      const headerLength = headerRegex.exec(trimmed)[0].length;
      const headerText = trimmed.substring(headerLength).trim();
      return this.getHeader(headerText, headerLength);
    } else {
      // Assume it is a paragraph
      return this.getParagraph(trimmed);
    }
  }

  getListItem(innerText) {
    return listItem;
  }

  appendItemToList(innerText, list) {
    const listMatch = new RegExp(/^([0-9]+\.|(-|\+|\*))/);
    const listItem = document.createElement('li');
    listItem.innerText = innerText.replace(listMatch, '').trim();
    list.appendChild(listItem);
  }

  getOrderedList() {
    return document.createElement('ol');
  }

  getUnorderedList() {
    return document.createElement('ul');
  }

  getHtml(text) {
    const split = text.split('\n');

    const elements = [];

    // List elements
    const O_LIST = 'O_LIST', UO_LIST = 'UO_LIST';
    let inList = false;
    let currentList;
    let currentListType;

    // List matches
    const listMatch = new RegExp(/^([0-9]+\.|(-|\+|\*))/);
    const orderedMatch = new RegExp(/^[0-9]+\./);

    const tabMatch = new RegExp(/^\s{4}/);

    function resetAllSpecialElements() {
      // Reset list types
      inList = currentList = currentListType = null;
    }

    split.forEach((line) => {
      if (listMatch.exec(line.trim())) {
        let nextListType = orderedMatch.exec(line.trim()) ? O_LIST : UO_LIST;
        if (!inList || nextListType !== currentListType) {
          // Create an ordered list
          currentList = nextListType === O_LIST ? this.getOrderedList() : this.getUnorderedList();
          currentListType = nextListType;
          inList = true;
          elements.push(currentList);
        }

        this.appendItemToList(line, currentList);
      } else if (line.trim() != '') {
        // Else we are in a non-empty text element
        resetAllSpecialElements();
        elements.push(this.getHtmlTextElement(line));
      } else {
        resetAllSpecialElements();
      }
    });

    return elements.map((e) => e.outerHTML).join('');
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

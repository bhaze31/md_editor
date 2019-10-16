class MDProcessor {
  constructor(lines) {
    this.lines = lines;
    this.elements = [];

    // List elements
    this.O_LIST = 'O_LIST';
    this.UO_LIST = 'UO_LIST';
    this.inList = false;
    this.currentList;
    this.currentListType;

    // List information
    this.listMatch = new RegExp(/^([0-9]+\.|(-|\+|\*))/);
    this.orderedMatch = new RegExp(/^[0-9]+\./);
  };

  resetAllSpecialElements() {
    // List elements
    this.inList = false;
    this.currentList = null;
    this.currentListType = null;
  };

  updateLines(lines) {
    this.lines = lines;
    return this;
  };

  parseHeader(line) {
    const headerRegex = new RegExp('^#+');
    let headerLength = headerRegex.exec(line)[0].length;
    const headerText = line.substring(headerLength).trim();
    if (headerLength > 6) {
      headerLength = 6;
    }
    return { element: `h${headerLength}`, text: headerText };
  };

  parseParagraph(line) {
    return { element: 'p', text: line };
  };

  parseImage(line) {
    const altMatch = new RegExp(/!\[.+\]/);
    const descMatch = new RegExp(/\(.+\)/);
    const altInfo = altMatch.exec(line)[0].replace('![', '').replace(']', '');
    const descInfo = descMatch.exec(line)[0].replace('(', '').replace(')', '').split(' ');
    const imgSrc = descInfo[0];
    const titleInfo = descInfo.slice(1).join(' ');
    return { element: 'img', src: imgSrc, alt: altInfo, title: titleInfo };
  };

  parseTextElement(line) {
    const trimmed = line.trim();
    const imageMatch = new RegExp(/^!\[.+\]\(.+\)$/);

    if (trimmed.startsWith('#')) {
      return this.parseHeader(trimmed);
    } else if (imageMatch.exec(trimmed)) {
      return this.parseImage(trimmed);
    } else {
      return this.parseParagraph(trimmed);
    }
  };

  parseListItem(line) {
    const listMatch = new RegExp(/^([0-9]+\.|(-|\+|\*))/);
    const text = line.replace(listMatch, '').trim();
    return { element: 'li', text };
  };

  parseList(line) {
    let nextListType = this.orderedMatch.exec(line.trim()) ? this.O_LIST : this.UO_LIST;
    if (!this.inList || nextListType !== this.currentListType) {
      // Create an ordered list
      this.currentList = nextListType === this.O_LIST ? this.getOrderedList() : this.getUnorderedList();
      this.currentListType = nextListType;
      this.inList = true;
      this.elements.push(this.currentList);
    }

    this.currentList.children.push(this.parseListItem(line));
  };

  getOrderedList() {
    return { element: 'ol', children: [] };
  };

  getUnorderedList() {
    return { element: 'ul', children: [] };
  };

  parse() {
    // Reset elements
    this.elements = [];

    this.lines.forEach((line) => {
      if (this.listMatch.exec(line.trim())) {
        this.parseList(line);
      } else if (line.trim() != '') {
        // Else we are in a non-empty text element
        this.resetAllSpecialElements();

        this.elements.push(this.parseTextElement(line));
      } else {
        this.resetAllSpecialElements();
      }
    })

    return this.elements;
  };
}

class MDConverter {
  constructor(data) {
    this.data = data;
  };

  updateData(data) {
    this.data = data;
    return this;
  };

  setTextElements(element, item) {
    element.innerText = item.text;
  };

  setImageElements(element, item) {
    element.src = item.src;
    element.alt = item.alt;
    element.title = item.title;
  };

  createElement(item, parentElement) {
    let element = document.createElement(item.element);
    switch (item.element) {
      case 'img':
        this.setImageElements(element, item);
        break;
      case 'ul':
      case 'ol':
        break;
      default:
        this.setTextElements(element, item);
    }

    if (item.children && item.children.length) {
      item.children.forEach((child) => {
        this.createElement(child, element);
      })
    }

    parentElement.appendChild(element);
  };

  convert(parentElement) {
    parentElement.innerHTML = '';
    this.data.forEach((item) => {
      this.createElement(item, parentElement);
    });
  };
}

window.onload = function() {
    var converter = new MDConverter([]);
    var processor = new MDProcessor([]);
    var pad = document.getElementById('pad');
    var markdownArea = document.getElementById('markdown');

    var convertTextAreaToMarkdown = function() {
        var markdownText = pad.value;
        var data = processor.updateLines(markdownText.split('\n')).parse();
        html = converter.updateData(data).convert(markdownArea);
    }

    pad.addEventListener('input', convertTextAreaToMarkdown);

    convertTextAreaToMarkdown();
};

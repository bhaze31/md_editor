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
    this.currentIndentLength = 0;
    this.currentSubList = 0;

    // List information
    this.listMatch = new RegExp(/^([0-9]+\.|(-|\+|\*))/);
    this.orderedMatch = new RegExp(/^[0-9]+\./);
  };

  resetAllSpecialElements() {
    // List elements
    this.inList = false;
    this.currentList = null;
    this.currentListType = null;
    this.currentIndentLength = 0;
    this.currentSubList = 0;
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

    if (line.startsWith('  ') && this.inList) {
      // We are attempting to create a sub list
      let indents = 0;
      const indentRegex = new RegExp(/  /g);

      // Find how many indentations we have currently
      while (indentRegex.exec(line)) {
        indents += 1;
      }

      if (this.currentIndentLength < indents) {
        // We are indenting more than before, create a sub list
        this.currentSubList += 1;

        // Hold access to current list for reference from child list
        const parentList = this.currentList;

        // Get previously created element
        const listItem = parentList.children[parentList.children.length - 1]
        listItem.children = [];

        // Create a new list to append to sublist
        this.currentList = nextListType === this.O_LIST ? this.getOrderedList() : this.getUnorderedList();

        // Add sub list to children of the last list item
        listItem.children.push(this.currentList);

        // Set the parent of the current list to be able to move up levels
        this.currentList.parentList = parentList;
      } else if (this.currentIndentLength > indents) {
        // TODO: Handle going back multiple lists
        this.currentSubList -= 1;
        const childList = this.currentList;
        this.currentList = childList.parentList;
      }

      this.currentList.children.push(this.parseListItem(line.trim()));
      this.currentIndentLength = indents;
    } else if (this.inList && this.currentSubList > 0) {
      // We have moved back to the base list, loop until root parent
      let parentList = this.currentList.parentList;
      while (parentList.parentList) {
        parentList = parentList.parentList;
      }

      this.currentList = parentList;

      // Reset indentation
      this.currentIndentLength = 0;
      this.currentSubList = 0;

      this.currentList.children.push(this.parseListItem(line.trim()))
    } else if (!this.inList || nextListType !== this.currentListType) {
      this.currentList = nextListType === this.O_LIST ? this.getOrderedList() : this.getUnorderedList();
      this.currentListType = nextListType;
      this.inList = true;
      this.elements.push(this.currentList);
      this.currentList.children.push(this.parseListItem(line.trim()));
    } else {
      this.currentList.children.push(this.parseListItem(line.trim()));
    }
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
    this.resetAllSpecialElements();

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

var processor = new MDProcessor([]);
var converter = new MDConverter([]);

window.onload = function() {
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

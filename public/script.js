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
    this.currentListIndentLength = 0;
    this.currentSubList = 0;

    // List information
    this.listMatch = new RegExp(/^([0-9]+\.|(-|\+|\*))/);
    this.orderedMatch = new RegExp(/^[0-9]+\./);

    // Blockquote elements
    this.inBlockquote = false;
    this.currentBlockquote;
    this.currentBlockquoteIndentLength = 0;
    this.currentSubQuote = 0;
    this.shouldAppendParagraph = false;

    // Blockquote information
    this.blockMatch = new RegExp(/^>+/);

    // Horizontal information
    this.horizontalMatch = new RegExp(/^(\*{3,}|-{3,}|_{3,})$/);

    // Break information
    this.breakMatch = new RegExp(/ {2,}$/);

    // Link + Image information
    this.altMatch = new RegExp(/!?\[.+\]/);
    this.descMatch = new RegExp(/\(.+\)/);

    // Link information
    this.linkMatch = new RegExp(/\[[\w\s"']+\]\([\w\s\/:\."']+\)/);

    // Image information
    this.imageMatch = new RegExp(/^!\[.+\]\(.+\)$/);

    // Link Image information
    this.linkImageMatch = new RegExp(/^\[!\[[\w\s"']+\]\([\w\s\/:\."']+\)\]\([\w\s\/:\."']+\)$/)
  };

  resetAllSpecialElements() {
    // List elements
    this.inList = false;
    this.currentList = null;
    this.currentListType = null;
    this.currentListIndentLength = 0;
    this.currentSubList = 0;

    // Blockquote elements
    this.inBlockquote = false;
    this.currentBlockquote = null;
    this.currentBlockquoteIndentLength = 0;
    this.currentSubQuote = 0;
    this.shouldAppendParagraph = false;
  };

  updateLines(lines) {
    this.lines = lines;
    return this;
  };

  parseLinks(line) {
    // Necessary to loop through with global flag
    let linkMatchLoop = new RegExp(/\[[\w\s"']+\]\([\w\s\/:\."']+\)/g)
    let match;
    let links = [];
    while (match = this.linkMatch.exec(line)) {
      const link = match[0];
      const altInfo = this.altMatch.exec(link)[0].replace(/(\[|\]|!\[)/g, '');
      const descInfo = this.descMatch.exec(link)[0].replace(/(\(|\))/g, '').split(' ');
      const href = descInfo[0];
      const title = descInfo.slice(1).join(' ');
      links.push({ href: href, text: altInfo, title: title });
      const anchor = `<a!>${altInfo}<!a>`;
      line = line.replace(this.linkMatch, anchor);
    }

    return { text: line, links: links };
  };

  parseHeader(line) {
    const headerRegex = new RegExp('^#+');
    let headerLength = headerRegex.exec(line)[0].length;
    const headerText = line.substring(headerLength).trim();
    if (headerLength > 6) {
      headerLength = 6;
    }

    return { element: `h${headerLength}`, ...this.parseLinks(headerText) };
  };

  parseParagraph(line) {
    return { element: 'p', ...this.parseLinks(line)};
  };

  parseImage(line) {
    const altInfo = this.altMatch.exec(line)[0].replace('![', '').replace(']', '');
    const descInfo = this.descMatch.exec(line)[0].replace('(', '').replace(')', '').split(' ');
    const imgSrc = descInfo[0];
    const titleInfo = descInfo.slice(1).join(' ');
    return { element: 'img', src: imgSrc, alt: altInfo, title: titleInfo };
  };

  parseTextElement(line) {
    const trimmed = line.trim();

    if (trimmed.startsWith('#')) {
      return this.parseHeader(trimmed);
    } else if (this.imageMatch.exec(trimmed)) {
      return this.parseImage(trimmed);
    } else {
      return this.parseParagraph(trimmed);
    }
  };

  parseListItem(line) {
    const listMatch = new RegExp(/^([0-9]+\.|(-|\+|\*))/);
    const text = line.replace(listMatch, '').trim();
    return { element: 'li', ...this.parseLinks(text) };
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

      if (this.currentListIndentLength < indents) {
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
      } else if (this.currentListIndentLength > indents) {
        // TODO: Handle going back multiple lists
        this.currentSubList -= 1;
        const childList = this.currentList;
        this.currentList = childList.parentList;
      }

      this.currentList.children.push(this.parseListItem(line.trim()));
      this.currentListIndentLength = indents;
    } else if (this.inList && this.currentSubList > 0) {
      // We have moved back to the base list, loop until root parent
      let parentList = this.currentList.parentList;
      while (parentList.parentList) {
        parentList = parentList.parentList;
      }

      this.currentList = parentList;

      // Reset indentation
      this.currentListIndentLength = 0;
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

  parseBlockquote(line) {
    // TODO: Assign quote indent to be able to properly indent with mismatched
    // blockquote lengths
    const quoteRegex = new RegExp(/^>+/g);
    let quoteIndent = quoteRegex.exec(line)[0].length;

    if (this.inBlockquote && this.currentBlockquoteIndentLength < quoteIndent) {
      // Create a new blockquote within the current one
      const parentQuote = this.currentBlockquote;
      this.currentBlockquote = this.getBlockquote();

      parentQuote.children.push(this.currentBlockquote);
      this.currentBlockquote.parentQuote = parentQuote;

      const paragraph = this.parseParagraph(line.replace(this.blockMatch, '').trim());
      this.currentBlockquote.children.push(paragraph);

      this.currentBlockquoteIndentLength = quoteIndent;
    } else if (this.inBlockquote && this.currentBlockquoteIndentLength > quoteIndent) {
      // Go back to a previous blockquote
      let currentQuote = this.currentBlockquote;
      let quoteDifference = this.currentBlockquoteIndentLength - quoteIndent;
      while (quoteDifference > 0) {
        if (!currentQuote.parentQuote) {
          // Difference was greater than number of steps back, set difference to 0
          break;
        }
        currentQuote = currentQuote.parentQuote;
        quoteDifference--;
      }

      this.currentBlockquote = currentQuote;

      const paragraph = this.parseParagraph(line.replace(this.blockMatch, '').trim());
      this.currentBlockquote.children.push(paragraph);

      this.currentBlockquoteIndentLength = quoteIndent;
    } else if (this.inBlockquote) {
      // In current blockquote, check if we should append to the current text
      if (line.replace(this.blockMatch, '').trim() === '') {
        // We are adding another paragraph element
        this.shouldAppendParagraph = true;
      } else {
        // Append to the current quote
        if (this.shouldAppendParagraph) {
          // We have a blank line, create a new paragraph in this blockquote level
          // Reset appending paragraph
          this.shouldAppendParagraph = false;

          // Create a new paragraph and append to the current children
          const paragraph = this.parseParagraph(line.replace(this.blockMatch, '').trim());
          this.currentBlockquote.children.push(paragraph);
        } else {
          const paragraph = this.currentBlockquote.children[this.currentBlockquote.children.length - 1];
          paragraph.text = paragraph.text + ` ${line.replace(this.blockMatch, '').trim()}`;
        }
      }
    } else {
      // Create a blockquote element
      const blockquote = this.getBlockquote();

      // Create the paragraph element
      const paragraph = this.parseParagraph(line.replace(this.blockMatch, '').trim());
      blockquote.children.push(paragraph);

      this.inBlockquote = true;
      this.currentBlockquote = blockquote;
      this.currentBlockquoteIndentLength = quoteIndent;
      this.elements.push(blockquote);
    }
  };

  getOrderedList() {
    return { element: 'ol', children: [] };
  };

  getUnorderedList() {
    return { element: 'ul', children: [] };
  };

  getBlockquote() {
    return { element: 'blockquote', children: [] };
  };

  addHorizontalRule() {
    this.elements.push({ element: 'hr' });
  };

  addBreak() {
    this.elements.push({ element: 'br' });
  };

  parse() {
    // Reset elements
    this.elements = [];
    this.resetAllSpecialElements();

    this.lines.forEach((line) => {
      if (this.horizontalMatch.exec(line.trim())) {
        this.addHorizontalRule();
      } else if (this.listMatch.exec(line.trim())) {
        this.parseList(line);
      } else if (this.blockMatch.exec(line.trim())) {
        this.parseBlockquote(line.trim());
      } else if (line.trim() != '') {
        // Else we are in a non-empty text element
        this.resetAllSpecialElements();

        this.elements.push(this.parseTextElement(line));
      } else {
        this.resetAllSpecialElements();
      }

      if (this.breakMatch.exec(line)) {
        this.addBreak();
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
    let innerText = item.text;
    if (item.links) {
      item.links.forEach((link) => {
        const anchor = document.createElement('a');
        const anchorRegex = new RegExp(`<a!>${link.text}<!a>`);
        anchor.href = link.href;
        anchor.innerText = link.text;
        if (link.title) {
          anchor.title = link.title;
        }

        innerText = innerText.replace(anchorRegex, anchor.outerHTML);
      })
    }

    element.innerHTML = innerText;
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
      case 'blockquote':
      case 'ul':
      case 'ol':
      case 'hr':
      case 'br':
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

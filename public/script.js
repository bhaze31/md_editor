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

    // Div elements
    this.inDiv = false;
    this.currentDiv;
    this.divMatch = new RegExp(/^<<-[A-Za-z0-9]{3}/)
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
    var linkMatchLoop = new RegExp(/\[[\w\s"']+\]\([\w\s\/:\."']+\)/g)
    var match;
    var links = [];
    while (match = this.linkMatch.exec(line)) {
      var link = match[0];
      var altInfo = this.altMatch.exec(link)[0].replace(/(\[|\]|!\[)/g, '');
      var descInfo = this.descMatch.exec(link)[0].replace(/(\(|\))/g, '').split(' ');
      var href = descInfo[0];
      var title = descInfo.slice(1).join(' ');
      links.push({ href: href, text: altInfo, title: title });
      var anchor = `<a!>${altInfo}<!a>`;
      line = line.replace(this.linkMatch, anchor);
    }

    return { text: line, links: links };
  };

  parseHeader(line) {
    var headerRegex = new RegExp('^#+');
    var headerLength = headerRegex.exec(line)[0].length;
    var headerText = line.substring(headerLength).trim();
    if (headerLength > 6) {
      headerLength = 6;
    }

    return { element: `h${headerLength}`, ...this.parseLinks(headerText) };
  };

  parseParagraph(line) {
    return { element: 'p', ...this.parseLinks(line)};
  };

  parseImage(line) {
    var altInfo = this.altMatch.exec(line)[0].replace('![', '').replace(']', '');
    var descInfo = this.descMatch.exec(line)[0].replace('(', '').replace(')', '').split(' ');
    var imgSrc = descInfo[0];
    var titleInfo = descInfo.slice(1).join(' ');
    return { element: 'img', src: imgSrc, alt: altInfo, title: titleInfo };
  };

  parseTextElement(line) {
    var trimmed = line.trim();

    if (trimmed.startsWith('#')) {
      return this.parseHeader(trimmed);
    } else if (this.imageMatch.exec(trimmed)) {
      return this.parseImage(trimmed);
    } else {
      return this.parseParagraph(trimmed);
    }
  };

  parseListItem(line) {
    var listMatch = new RegExp(/^([0-9]+\.|(-|\+|\*))/);
    var text = line.replace(listMatch, '').trim();
    return { element: 'li', ...this.parseLinks(text) };
  };

  parseList(line) {
    var nextListType = this.orderedMatch.exec(line.trim()) ? this.O_LIST : this.UO_LIST;

    if (line.startsWith('  ') && this.inList) {
      // We are attempting to create a sub list
      var indents = 0;
      var indentRegex = new RegExp(/  /g);

      // Find how many indentations we have currently
      while (indentRegex.exec(line)) {
        indents += 1;
      }

      if (this.currentListIndentLength < indents) {
        // We are indenting more than before, create a sub list
        this.currentSubList += 1;

        // Hold access to current list for reference from child list
        var parentList = this.currentList;

        // Get previously created element
        var listItem = parentList.children[parentList.children.length - 1]
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
        var childList = this.currentList;
        this.currentList = childList.parentList;
      }

      this.currentList.children.push(this.parseListItem(line.trim()));
      this.currentListIndentLength = indents;
    } else if (this.inList && this.currentSubList > 0) {
      // We have moved back to the base list, loop until root parent
      var parentList = this.currentList.parentList;
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
      this.addToElements(this.currentList);
      this.currentList.children.push(this.parseListItem(line.trim()));
    } else {
      this.currentList.children.push(this.parseListItem(line.trim()));
    }
  };

  parseBlockquote(line) {
    // TODO: Assign quote indent to be able to properly indent with mismatched
    // blockquote lengths
    var quoteRegex = new RegExp(/^>+/g);
    var quoteIndent = quoteRegex.exec(line)[0].length;

    if (this.inBlockquote && this.currentBlockquoteIndentLength < quoteIndent) {
      // Create a new blockquote within the current one
      var parentQuote = this.currentBlockquote;
      this.currentBlockquote = this.getBlockquote();

      parentQuote.children.push(this.currentBlockquote);
      this.currentBlockquote.parentQuote = parentQuote;

      var paragraph = this.parseParagraph(line.replace(this.blockMatch, '').trim());
      this.currentBlockquote.children.push(paragraph);

      this.currentBlockquoteIndentLength = quoteIndent;
    } else if (this.inBlockquote && this.currentBlockquoteIndentLength > quoteIndent) {
      // Go back to a previous blockquote
      var currentQuote = this.currentBlockquote;
      var quoteDifference = this.currentBlockquoteIndentLength - quoteIndent;
      while (quoteDifference > 0) {
        if (!currentQuote.parentQuote) {
          // Difference was greater than number of steps back, set difference to 0
          break;
        }
        currentQuote = currentQuote.parentQuote;
        quoteDifference--;
      }

      this.currentBlockquote = currentQuote;

      var paragraph = this.parseParagraph(line.replace(this.blockMatch, '').trim());
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
          var paragraph = this.parseParagraph(line.replace(this.blockMatch, '').trim());
          this.currentBlockquote.children.push(paragraph);
        } else {
          var paragraph = this.currentBlockquote.children[this.currentBlockquote.children.length - 1];
          paragraph.text = paragraph.text + ` ${line.replace(this.blockMatch, '').trim()}`;
        }
      }
    } else {
      // Create a blockquote element
      var blockquote = this.getBlockquote();

      // Create the paragraph element
      var paragraph = this.parseParagraph(line.replace(this.blockMatch, '').trim());
      blockquote.children.push(paragraph);

      this.inBlockquote = true;
      this.currentBlockquote = blockquote;
      this.currentBlockquoteIndentLength = quoteIndent;
      this.addToElements(blockquote);
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
    this.addToElements({ element: 'hr' });
  };

  addDiv(line) {
    this.addToElements({ element: 'div', identifier: line.replace('<<-', ''), children: [] });
  };

  addBreak() {
    this.addToElements({ element: 'br' });
  };

  addToElements(element) {
    if (this.inDiv) {
      // We currently have a div, check to see if it is being closed
      if (element.element === 'div' && element.identifier === this.currentDiv.identifier) {
        // We are in the div, closing
        // If there is a parent div, set that to the current div
        if (this.currentDiv.parentDiv) {
          this.currentDiv = this.currentDiv.parentDiv;
        } else {
          // We don't have a parent div
          this.currentDiv = null;
          this.inDiv = false;
        }
      } else {
        this.currentDiv.children.push(element);
        if (element.element === 'div') {
          element.parentDiv = this.currentDiv;
          this.currentDiv = element;
        }
      }
    } else {
      this.elements.push(element);
      if (element.element === 'div') {
        this.inDiv = true;
        this.currentDiv = element;
      }
    }
  };

  parse() {
    // Reset elements
    this.elements = [];
    this.resetAllSpecialElements();
    this.inDiv = false;

    this.lines.forEach((line) => {
      if (this.horizontalMatch.exec(line.trim())) {
        this.addHorizontalRule();
      } if (this.divMatch.exec(line.trim())) {
        this.addDiv(line);
      } else if (this.listMatch.exec(line.trim())) {
        this.parseList(line);
      } else if (this.blockMatch.exec(line.trim())) {
        this.parseBlockquote(line.trim());
      } else if (line.trim() != '') {
        // Else we are in a non-empty text element
        this.resetAllSpecialElements();

        this.addToElements(this.parseTextElement(line));
      } else {
        this.resetAllSpecialElements();
      }

      if (this.breakMatch.exec(line)) {
        this.addBreak();
      }
    });

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
    var innerText = item.text;
    if (item.links) {
      item.links.forEach((link) => {
        var anchor = document.createElement('a');
        var anchorRegex = new RegExp(`<a!>${link.text}<!a>`);
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
      case 'div':
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
    var content = document.getElementById('content');
    var styles = document.getElementById('styles');
    var markdownArea = document.getElementById('markdown');

    var convertTextAreaToMarkdown = function() {
        var markdownText = content.value;
        var data = processor.updateLines(markdownText.split('\n')).parse();
        html = converter.updateData(data).convert(markdownArea);
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

// Lifted from appium-mcp: src/locators/source-parsing.ts (Apache-2.0)
// Adapted to plain Node ESM (types removed). See NOTICE.
import { DOMParser, MIME_TYPE, XMLSerializer } from '@xmldom/xmldom';

const domParser = new DOMParser();
const xmlSerializer = new XMLSerializer();

export const xmlToDOM = (string) =>
  domParser.parseFromString(string, MIME_TYPE.XML_TEXT);
export const domToXML = (dom) => xmlSerializer.serializeToString(dom);

/**
 * Get the child nodes of a Node object
 */
export function childNodesOf(domNode) {
  if (!domNode?.hasChildNodes()) {
    return [];
  }
  return Array.from(domNode.childNodes).filter(
    (childNode) => childNode.nodeType === domNode.ELEMENT_NODE
  );
}

/**
 * Look up an element in the Document source using the provided path
 */
export function findDOMNodeByPath(path, sourceDoc) {
  let selectedElement =
    childNodesOf(sourceDoc)[0] ||
    (sourceDoc.documentElement
      ? childNodesOf(sourceDoc.documentElement)[0]
      : null);
  if (!selectedElement) {
    throw new Error('No element found in document');
  }
  for (const index of path.split('.')) {
    selectedElement = childNodesOf(selectedElement)[parseInt(index, 10)];
  }
  return selectedElement;
}

/**
 * Look up an element in the JSON source using the provided path
 */
export function findJSONElementByPath(path, sourceJSON) {
  let selectedElement = sourceJSON;
  for (const index of path.split('.')) {
    selectedElement = selectedElement.children[parseInt(index, 10)];
  }
  return { ...selectedElement };
}

/**
 * Translates sourceXML to JSON
 */
export function xmlToJSON(sourceXML) {
  const translateRecursively = (domNode, parentPath = '', index = null) => {
    const attributes = {};
    if (domNode.attributes) {
      const elementNode = domNode;
      for (
        let attrIdx = 0;
        attrIdx < elementNode.attributes.length;
        ++attrIdx
      ) {
        const attr = elementNode.attributes.item(attrIdx);
        if (attr) {
          // it should be show new line character(\n) in GUI
          attributes[attr.name] = attr.value.replace(/(\n)/gm, '\\n');
        }
      }
    }

    // Dot Separated path of indices
    const path =
      index == null ? '' : `${!parentPath ? '' : parentPath + '.'}${index}`;

    return {
      children: childNodesOf(domNode).map((childNode, childIndex) =>
        translateRecursively(childNode, path, childIndex)
      ),
      tagName: domNode.nodeName,
      attributes,
      path,
    };
  };

  const sourceDoc = xmlToDOM(sourceXML);
  // get the first child element node in the doc. some drivers write their xml differently so we
  // first try to find an element as a direct descended of the doc, then look for one in
  // documentElement
  const firstChild =
    childNodesOf(sourceDoc)[0] ||
    (sourceDoc.documentElement
      ? childNodesOf(sourceDoc.documentElement)[0]
      : null);

  return firstChild
    ? translateRecursively(firstChild)
    : {
        children: [],
        tagName: '',
        attributes: {},
        path: '',
      };
}

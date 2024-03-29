import { OdooEditor } from './editor.js';

const localStorageKey = 'odoo-editor-localHtmlSaved';

function startEditor(testHTML) {
    const editableContainer = document.getElementById('dom');
    editableContainer.innerHTML = testHTML;
    const editor = new OdooEditor(editableContainer, {
        toolbar: document.querySelector('#toolbar'),
        autohideToolbar: true,
        defaultLinkAttributes: { target: '_blank', rel: 'ugc' },
    });
    editor.historyFetch();

    // local storage show / hide elements
    document.getElementById('save-i-html-button').style.display = 'inline-block';
    document.getElementById('save-c-html-button').style.display = 'inline-block';
    document.getElementById('saved-html-list').remove();
}

function setContent(content) {
    window.location = `${location.pathname.slice(0, -1)}?html=${btoa(content)}`;
}
/**
 * Quick UI to start editing
 */
const submitButtonEl = document.getElementById('textarea-submit');
submitButtonEl.addEventListener('click', () => {
    setContent(document.getElementById('textarea').value);
});
const useSampleEl = document.getElementById('use-sample');
useSampleEl.addEventListener('click', () => {
    setContent(document.getElementById('sample-dom').innerHTML);
});
// url with custom text
const customTextParam = location.search.slice(1);
if (customTextParam && customTextParam.startsWith('html=')) {
    try {
        const testHTML = atob(customTextParam.substring(5));
        startEditor(testHTML);
        document.getElementById('control-panel').remove();
    } catch (e) {
        console.error(e);
    }
} else {
    // fill in the storred html snippets
    const localHtmlStored = localStorage.getItem(localStorageKey);
    const container = document.getElementById('saved-html-list');
    if (localHtmlStored) {
        const localHtmlSaved = JSON.parse(localHtmlStored);
        for (const [key, value] of Object.entries(localHtmlSaved)) {
            const link = document.createElement('a');
            const linkText = document.createTextNode('⮞ Start editing "' + key + '"');
            link.title = key + ' html snippet';
            link.href = './?html=' + btoa(value);

            link.appendChild(linkText);
            container.appendChild(link);
        }
    } else {
        container.style.display = 'none';
    }
}

/**
 * local storage for storing html snippet
 */

function addLocalHtmlSave(html) {
    const localHtmlStored = localStorage.getItem(localStorageKey);
    console.log('localHtmlStored = ', localHtmlStored);

    const localHtmlSaved = localHtmlStored ? JSON.parse(localHtmlStored) : {};

    var name = prompt('Enter a storage name for this html snippet', 'unnamed');
    localHtmlSaved[name] = html;
    localStorage.setItem(localStorageKey, JSON.stringify(localHtmlSaved));
}

const saveInitialHtmlButton = document.getElementById('save-i-html-button');
const saveCurrentHtmlButton = document.getElementById('save-c-html-button');

saveInitialHtmlButton.addEventListener('click', () => {
    const html = atob(location.search.slice(1).substring(5));
    addLocalHtmlSave(html);
});
saveCurrentHtmlButton.addEventListener('click', () => {
    const html = document.getElementById('dom').innerHTML;
    addLocalHtmlSave(html);
});

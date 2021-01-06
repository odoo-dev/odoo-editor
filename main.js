import { OdooEditor } from "./editor.js";

function startEditor(testHTML) {
  const editableContainer = document.getElementById('dom');
  editableContainer.innerHTML = testHTML;
  const editor = new OdooEditor(editableContainer, { toolbar: true });
  document.getElementById('vdom').append(editor.vdom);
  editor.historyFetch();
}

/**
* Quick UI to start editing
*/
const submitButtonEl = document.getElementById('textarea-submit');
submitButtonEl.addEventListener('click', () => {
  submitButtonEl.disabled = true;
  const testHTML = document.getElementById('textarea').value;
  startEditor(testHTML);
  history.replaceState({}, 'Odoo Editor', `/?${btoa(testHTML)}`);
  document.getElementById('control-panel').remove();
});
const useSampleEl = document.getElementById('use-sample');
useSampleEl.addEventListener('click', () => {
  useSampleEl.disabled = true;
  const testHTML = document.getElementById('sample-dom').innerHTML;
  startEditor(testHTML);
  document.getElementById('control-panel').remove();
});
// url with custom text
const customTextParam = location.search.slice(1);
if (customTextParam) {
  try {
      const testHTML = atob(customTextParam);
      startEditor(testHTML);
      document.getElementById('control-panel').remove();
  } catch (e) {
      console.error(e);
  }
}

import { ancestors } from '../utils/utils.js';

export class QWebPlugin {
    constructor(editor) {
        this._editor = editor;
        this._tGroupCount = 0;
        this._makeSelect();
    }
    technicalElement(subRoot) {
        if (subRoot.nodeType !== Node.ELEMENT_NODE) {
            return;
        }
        const tNodes = subRoot.querySelectorAll('[t-if], [t-elif], [t-else]');
        const groupsEncounter = new Set();
        for (let i = 0; i < tNodes.length; i++) {
            const prevNode = tNodes[i - 1];
            const node = tNodes[i];
            let groupId;
            if (prevNode && node.previousElementSibling === prevNode) {
                groupId = parseInt(prevNode.getAttribute('data-oe-t-group'));
            } else {
                groupId = this._tGroupCount++;
            }
            groupsEncounter.add(groupId);
            node.setAttribute('data-oe-t-group', groupId);

            node.addEventListener('click', () => {
                const nodes = node.parentElement.querySelectorAll(`[data-oe-t-group='${groupId}']`);
                if (nodes.length > 1) {
                    this._positionSelect(node);
                }
                const _closeSelect = e => {
                    const path = [e.target, ...ancestors(e.target)];
                    const found = path.find(
                        el =>
                            el === this._selectElWrapper ||
                            el.getAttribute('data-oe-t-group') === '' + groupId,
                    );
                    if (!found) {
                        this._positionHide();
                        document.removeEventListener('mousedown', _closeSelect);
                    }
                };
                document.addEventListener('mousedown', _closeSelect);
            });
        }
        for (const groupId of groupsEncounter) {
            const isActive = subRoot.querySelector(
                `[data-oe-t-group='${groupId}'][data-oe-t-group-active]`,
            );
            if (!isActive) {
                subRoot
                    .querySelector(`[data-oe-t-group='${groupId}']`)
                    .setAttribute('data-oe-t-group-active', 'true');
            }
        }
    }
    cleanForSave(editable) {
        for (const node of editable.querySelectorAll('[data-oe-t-group]')) {
            node.removeAttribute('data-oe-t-group');
            node.removeAttribute('data-oe-t-group-active');
        }
    }
    _makeSelect() {
        this._selectElWrapper = document.createElement('div');
        this._selectElWrapper.classList.add('oe-qweb-select');
        this._selectElWrapper.innerHTML = `
            <select>
            </select>
        `;
        this._selectEl = this._selectElWrapper.querySelector('select');
        this._editor.document.body.append(this._selectElWrapper);
        this._positionHide();
    }
    _positionSelect(target) {
        this._selectElWrapper.style.display = 'block';

        const box = target.getBoundingClientRect();

        const selBox = this._selectElWrapper.getBoundingClientRect();

        this._selectEl.innerHTML = '';
        const groupId = parseInt(target.getAttribute('data-oe-t-group'));
        const groupElements = target.parentElement.querySelectorAll(
            `[data-oe-t-group='${groupId}']`,
        );
        for (const element of groupElements) {
            const optionElement = document.createElement('option');
            if (element.hasAttribute('t-if')) {
                optionElement.innerText = 't-if';
            } else if (element.hasAttribute('t-elif')) {
                optionElement.innerText = 't-elif';
            } else if (element.hasAttribute('t-else')) {
                optionElement.innerText = 't-else';
            }
            if (element.hasAttribute('data-oe-t-group-active')) {
                optionElement.selected = true;
            }
            this._selectEl.appendChild(optionElement);
        }

        this._selectEl.onchange = e => {
            for (let i = 0; i < groupElements.length; i++) {
                if (i === this._selectEl.selectedIndex) {
                    groupElements[i].setAttribute('data-oe-t-group-active', 'true');
                } else {
                    groupElements[i].removeAttribute('data-oe-t-group-active');
                }
            }
        };

        this._selectElWrapper.style.left = `${box.left}px`;
        this._selectElWrapper.style.top = `${box.top - selBox.height}px`;
    }
    _positionHide() {
        this._selectElWrapper.style.display = 'none';
    }
    destroy() {
        this._selectElWrapper.remove();
    }
}

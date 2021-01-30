import { createList, getListMode, isBlock, preserveCursor, toggleClass } from '../utils/utils.js';

Text.prototype.oTab = function (offset) {
    return this.parentElement.oTab(0);
};

HTMLElement.prototype.oTab = function (offset) {
    if (!isBlock(this)) {
        return this.parentElement.oTab(offset);
    }
    return false;
};

HTMLLIElement.prototype.oTab = function (offset) {
    let lip = document.createElement('li');
    let destul = this.previousElementSibling && this.previousElementSibling.querySelector('ol, ul');
    destul = destul || (this.nextElementSibling && this.nextElementSibling.querySelector('ol, ul'));
    destul = destul || this.closest('ul, ol');

    let ul = createList(getListMode(destul));
    lip.append(ul);

    const cr = preserveCursor(this.ownerDocument);
    toggleClass(lip, 'oe-nested');
    this.before(lip);
    ul.append(this);
    cr();
    return true;
};

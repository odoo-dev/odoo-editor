import {
    isUnbreakable,
    preserveCursor,
    toggleClass,
    isBlock,
    isVisible,
} from '../utils/utils.js';

Text.prototype.oShiftTab = function (offset) {
    return this.parentElement.oShiftTab(0);
};

HTMLElement.prototype.oShiftTab = function (offset = undefined) {
    if (!isUnbreakable(this)) {
        return this.parentElement.oShiftTab(offset);
    }
    return false;
};

// returns: is still in a <LI> nested list
HTMLLIElement.prototype.oShiftTab = function (offset) {
    let li = this;
    if (li.nextElementSibling) {
        let ul = li.parentElement.cloneNode(false);
        while (li.nextSibling) {
            ul.append(li.nextSibling);
        }
        if (li.parentNode.parentNode.tagName === 'LI') {
            let lip = document.createElement('li');
            toggleClass(lip, 'nested');
            lip.append(ul);
            li.parentNode.parentNode.after(lip);
        } else {
            li.parentNode.after(ul);
        }
    }

    const restoreCursor = preserveCursor();
    if (li.parentNode.parentNode.tagName === 'LI') {
        let toremove = !li.previousElementSibling ? li.parentNode.parentNode : null;
        let ul = li.parentNode;
        li.parentNode.parentNode.after(li);
        if (toremove) {
            if (toremove.classList.contains('nested')) {
                // <li>content<ul>...</ul></li>
                toremove.remove();
            } else {
                // <li class="nested"><ul>...</ul></li>
                ul.remove();
            }
        }
        restoreCursor();
        return li;
    } else {
        let ul = li.parentNode;
        let p;
        while (li.firstChild) {
            if (isBlock(li.firstChild)) {
                p = isVisible(p) && ul.after(p) && undefined;
                ul.after(li.firstChild);
            } else {
                p = p || document.createElement('P');
                p.append(li.firstChild);
            }
        }
        if (isVisible(p)) ul.after(p);

        restoreCursor(new Map([[li, ul.nextSibling]]));
        li.remove();
        if (!ul.firstElementChild) {
            ul.remove();
        }
    }
    return false;
};

"use strict";

class Editor {
    constructor(vdom, dom) {
        this.count = 0;
        this.vdom = vdom;
        this.dom = dom;
        this.history = [];
        this.undo = false;
        this.toDom();
        this.observer = new MutationObserver(records => {
            this.mutationApply(this.vdom, this.dom, records);
        }).observe(vdom, {
            childList: true,
            subtree: true,
            attributes: true,
            characterData: true,
            characterDataOldValue: true,
        });
        this.vdom.addEventListener('keydown', this.keyDown.bind(this));
    }
    //
    // DOM Handling: li
    //

    getLi(sel) {
        let node = sel.anchorNode;
        if (sel.rangeCount) {
            let range = sel.getRangeAt(0);
            if ((range.startContainer.nodeType == 1) && (node.tagName=='UL')) {
                node = range.startContainer.firstChild
                for (let i=0; i<range.startOffset; ++i)
                    if (node.nextSibling)
                        node = node.nextSibling;
            }
        }
        if (node.nodeType==3)
            node = node.parentNode;
        return node.closest('li');
    }

    listIndent(sel) {
        let li = this.getLi(sel);
        let lip = document.createElement("li")
        let ul = document.createElement("ul");
        lip.append(ul);
        lip.style.listStyle = "none";
        li.before(lip);
        ul.append(li);
        this.listSanitize(lip.closest("ul"));

        let range = new Range();
        range.setStart(li,0);
        range.setEnd(li,0);
        sel.removeAllRanges();
        sel.addRange(range);
        return li;
    }

    listOutdent(sel) {
        let li = this.getLi(sel);
        if (li.nextElementSibling) {
            let ul = document.createElement("ul");
            while (li.nextSibling)
                ul.append(li.nextSibling);
            if (li.parentNode.parentNode.tagName == 'LI') {
                let lip = document.createElement("li");
                lip.append(ul);
                lip.style.listStyle = "none";
                li.parentNode.parentNode.after(lip);
            } else
                li.parentNode.after(ul);
        }

        if (li.parentNode.parentNode.tagName == 'LI') {
            let toremove = (! li.previousElementSibling)?li.parentNode.parentNode:null;
            li.parentNode.parentNode.after(li);
            if (toremove) toremove.remove();
        } else {
            let ul = li.parentNode;
            while (li.firstChild)
                li.parentNode.after(li.firstChild);
            li.remove();
            if (! ul.firstElementChild) ul.remove();
        }

        this.listSanitize(li.closest("ul"));

        // duplicate code to remove
        let range = new Range();
        range.setStart(li,0);
        range.setEnd(li,0);
        sel.removeAllRanges();
        sel.addRange(range);
        return li;
    }

    // merge same level siblings
    listSanitize(ul) {
        let li = ul.firstElementChild;
        while (li) {
            if ((li.style.listStyle=="none") && li.nextElementSibling && (li.nextElementSibling.style.listStyle=="none")) {
                let curul = li.firstElementChild;
                let oldul = li.nextElementSibling.firstElementChild;
                while (oldul.firstChild)
                    curul.append(oldul.firstChild);
                li.nextElementSibling.remove();
            }
            li = li.nextElementSibling;
        }
    }

    //
    // keyboard handling
    //

    keyDown(event) {
        let sel = event.target.ownerDocument.defaultView.getSelection();
        // debugger;
        if (event.keyCode === 13) {                   // enter key
            if ((sel.anchorNode.tagName == 'LI') && (! sel.anchorNode.innerText.replace('\n', ''))) {
                event.preventDefault();
                let li = this.listOutdent(sel);
            }
        }
        else if (event.keyCode === 9) {                    // tab key
            event.preventDefault();  // this will prevent us from tabbing out of the editor
            if (this.getLi(sel)) {
                if (event.shiftKey) {
                    let li = this.listOutdent(sel);
                } else {
                    let li = this.listIndent(sel);
                }
            }
        }
        else if ((event.key == 'z') && event.ctrlKey) {                    // Ctrl Z: Undo
            event.preventDefault();
            this.historyPop();
        }
        else if ((event.key == 'y') && event.ctrlKey) {                    // Ctrl y: Undo
            event.preventDefault();
            alert('redo not implemented');
        }

        console.log('Key Down' + this + event + " "+event.target);

    }

    //
    // VDOM Processing
    //
    idSet(src, dest) {
        console.log("src: "+src.count+", dest:"+dest.count+" - "+(this.count+1));
        if (src.count) {
            dest.count = src.count;
        } else {
            src.count = dest.count = ++this.count;
        }
        let childsrc = src.firstChild;
        let childdest = dest.firstChild;
        while (childsrc) {
            this.idSet(childsrc, childdest);
            childsrc = childsrc.nextSibling;
            childdest = childdest.nextSibling;
        }
    }
    idFind(dom, id, parentid) {                        // todo: bissect optim to not traverse the whole tree
        let cur = dom.firstChild;
        while (cur) {
            if (cur.count==id && ((!parentid) || cur.parentNode.count==parentid))
                return cur;
            let result = this.idFind(cur, id, parentid);
            if (result)
                return result;
            cur = cur.nextSibling;
        }
    }
    toDom() {
        let olddom = this.dom;
        this.dom = this.vdom.cloneNode(true);
        olddom.parentNode.replaceChild(this.dom, olddom);
        this.idSet(this.vdom, this.dom);
    }
    historyPop(undo=true) {
        if (! this.history.length)
            return false;
        let action = this.history.pop();
        this.undo = true;
        switch (action.type) {
            case "characterData": 
                this.idFind(this.vdom, action.id).textContent = action.oldValue;
                break;
            case "remove": 
                if (action.nextId) {
                    this.idFind(this.vdom, action.nextId).before(action.node);
                }
                else {
                    this.idFind(this.vdom, action.parentId).append(action.node);
                }
                break;
            case "add": 
                let el = this.idFind(this.vdom, action.id);
                if (el) el.remove();
        }

        // group changes made together
        if (this.history.length && (action.time-this.history[this.history.length - 1].time) < 50) {
            this.history.pop(false)
        }

        // shitty hack to wait for mutation observer to finish: use take_records?
        if (undo) setTimeout( () => this.undo = false, 70);
    }
    mutationApply(srcel, destel, records) {
        for (let record of records) {
            switch (record.type) {
                case "characterData": 
                    if (! this.undo)
                        this.history.push({
                            'type': "characterData",
                            'id': record.target.count,
                            "text": record.target.textContent,
                            'time': Date.now(),
                            "oldValue": record.oldValue
                        });
                    this.idFind(destel, record.target.count).textContent = record.target.textContent;
                    break
                case "childList":
                    record.removedNodes.forEach( (removed, index) => {
                        if (! this.undo)
                            this.history.push({
                                'type': "remove",
                                'id': removed.count,
                                'parentId': record.target.count,
                                'time': Date.now(),
                                'node': removed,
                                'nextId': record.nextSibling ? record.nextSibling.count : undefined,
                            });
                        let toremove = this.idFind(destel, removed.count, record.target.count);
                        if (toremove)
                            toremove.remove()
                    });
                    record.addedNodes.forEach( (added, index) => {
                        if (added.count && this.idFind(destel, added.count)) {
                            if (record.target.count == this.idFind(destel, added.count).parentNode.count) {
                                console.log('    already!');
                                return;
                            }
                        }
                        let newnode = added.cloneNode(1);
                        this.idSet(added, newnode);
                        let action = {
                            'type': "add",
                            'id': added.count,
                            'time': Date.now(),
                            'node': newnode,
                        }
                        if (! record.nextSibling) {
                            this.idFind(destel, record.target.count).append(newnode);
                            action['append'] = record.target.count;
                        } else {
                            this.idFind(destel, record.nextSibling.count).before(newnode);
                            action['before'] = record.nextSibling.count;
                        }
                        action['node'] = newnode;
                        if (! this.undo)
                            this.history.push(action);
                    });
                    break;
                default:
                    console.log('Unknown mutation type: '+record.type)
            }
        }
        if (srcel.innerHTML!=destel.innerHTML) {
            console.log('DOM & vDOM differs');
        }
    }

}

let editor = new Editor(document.querySelector("[contentEditable=true]"), document.getElementById('dom'));
document.getElementById('dom-col').append(editor.dom);

document.getElementById('domAdd').addEventListener("click", (event) => {
    let newEl = document.createElement('div');
    newEl.innerHTML="This div is in <b>DOM</b> but not in <b>VDOM</b>.";
    editor.dom.querySelector('div,p,li').after(newEl);
});

document.getElementById('domChange').addEventListener("click", (event) => {
    let li = editor.dom.querySelector('li');
    li.firstChild.nodeValue="Changed in DOM!";
});

document.getElementById('domReset').addEventListener("click", (event) => {
    editor.toDom();
});


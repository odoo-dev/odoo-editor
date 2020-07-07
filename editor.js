"use strict";


class Editor {
    constructor(dom) {
        this.count = 0;
        this.mode = "dom";                    // dom, vdom, both
        this.dom = dom;
        this.vdom = dom.cloneNode(true);
        this.idSet(dom, this.vdom);
        this.dom_observer = new MutationObserver(records => {
            if (this.mode=="dom")
                this.mutationApply(this.dom, this.vdom, records);
        }).observe(dom, {
            childList: true,
            subtree: true,
            attributes: true,
            characterData: true,
        });
        this.dom.addEventListener('keydown', this.keyDown.bind(this));
    }
    //
    // DOM Handling
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
        if (! node.closest('li') )
            debugger;
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
        return li;
    }

    listOutdent(sel) {
        let li = this.getLi(sel);
        let lip;
        let toremove;

        if (li.parentNode.parentNode.tagName != 'LI')
            return;

        if (li.nextElementSibling) {
            lip = document.createElement("li");
            let ul = document.createElement("ul");
            lip.append(ul);
            lip.style.listStyle = "none";
            while (li.nextSibling)
                ul.append(li.nextSibling);
        }

        if (! li.previousElementSibling) toremove = li.parentNode.parentNode;
        li.parentNode.parentNode.after(li);
        if (toremove) toremove.remove();

        if (lip)
            li.after(lip);
        this.listSanitize(li.closest("ul"));
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
        if (event.keyCode === 13) {
            event.preventDefault();
            let sel = event.target.ownerDocument.defaultView.getSelection();
            let range = sel.getRangeAt(0);
        }
        if (event.keyCode === 9) {                    // tab key
            event.preventDefault();  // this will prevent us from tabbing out of the editor
            let sel = event.target.ownerDocument.defaultView.getSelection();
            if (event.shiftKey) {
                let li = this.listOutdent(sel);
                let range = new Range();
                range.setStart(li,0);
                range.setEnd(li,0);
                sel.removeAllRanges();
                sel.addRange(range);


            } else {
                let li = this.listIndent(sel);
                let range = new Range();
                range.setStart(li,0);
                range.setEnd(li,0);
                sel.removeAllRanges();
                sel.addRange(range);
            }
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
        this.dom.parentNode.replaceChild(this.vdom.cloneNode(true), this.dom);
    }
    fromDom() {

    }
    mutationApply(srcel, destel, records) {
        for (let record of records) {
            switch (record.type) {
                case "characterData": 
                    this.idFind(destel, record.target.count).textContent = record.target.textContent;
                    break
                case "childList":
                    record.removedNodes.forEach( (removed, index) => {
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
                        if (! record.nextSibling) {
                            this.idFind(destel, record.target.count).append(newnode);
                        } else {
                            this.idFind(destel, record.nextSibling.count).before(newnode);
                        }
                    });
                    break;
                default:
                    console.log('Unknown mutation type: '+record.type)
            }
        }
        if (srcel.innerHTML!=destel.innerHTML) {
            debugger;
        } else
            console.log('HTML Equal');
    }


    switchMode(newmode) {
        if (newMode=="dom") {
            this.toDom();
        } else if (newmode=="vdom") {
            this.fromDom();
        }
    }

}

let editor = new Editor(document.querySelector("[contentEditable=true]"));
document.getElementById('vdom-col').append(editor.vdom);
/*
setTimeout(() => {
    let li = document.getElementById('dom-col').querySelector('li');
    let newnode = li.cloneNode(true)
    newnode.append(document.createElement('b'));
    li.after(newnode);
}, 2000);

setTimeout(() => {
    let li = document.getElementById('dom-col').querySelector('li');
    let newnode = li.cloneNode(true)
    li.after(newnode);
}, 2000);
*/



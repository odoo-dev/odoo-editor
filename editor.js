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
	}

	// Assign IDs to DOM and VDOM elements to do an easy matching
	idSet(src, dest) {
		console.log("src: "+src.count+", dest:"+dest.count+" - "+(this.count+1));
		if (src.count) {
			dest.count = src.count;
		} else {
			src.count = dest.count = ++this.count;
		}
		if (src.nodeType == 3)
			console.log('Assigning '+(src.count)+' to '+src.textContent);
		else
			console.log('Assigning '+(src.count)+' to '+src.tagName);
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
		return undefined;
	}
	toDom() {
		this.dom.parentNode.replaceChild(this.vdom.cloneNode(true), this.dom);
	}
	fromDom() {

	}
	log(dom) {
		console.log(dom.firstChild);
		console.log(dom.firstChild);
	}
	mutationApply(srcel, destel, records) {
		for (let record of records) {
			console.log(record);
			switch (record.type) {
				case "characterData": 
					if (! record.target.count)
						debugger;
					this.idFind(destel, record.target.count).textContent = record.target.textContent;
					break
				case "childList":
					record.removedNodes.forEach( (removed, index) => {
						console.log('remove '+removed.count+': '+(removed.nodeType==3?removed.textContent:removed.tagName));
						let toremove = this.idFind(destel, removed.count, record.target.count);
						if (toremove)
							toremove.remove()
					});
					record.addedNodes.forEach( (added, index) => {
						if (added.count && this.idFind(destel, added.count)) {
							if (record.target.count == this.idFind(destel, added.count).parentNode.count) {
								console.log('    already!');
								return True;
							}
						}
						let newnode = added.cloneNode(1);
						console.log('added '+added.count+': '+(added.nodeType==3?added.textContent:added.tagName));
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
			console.log(destel.innerHTML);
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


console.log('ici');



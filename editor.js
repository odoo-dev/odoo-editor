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

	listIndent(sel) {
		let li = sel.anchorNode.parentNode.closest('li');    // to improve
		let lip = document.createElement("li")
		let ul = document.createElement("ul");
		lip.append(ul);
		lip.style.listStyle = "none";
		li.before(lip);
		ul.append(li);
		this.listSanitize(lip.closest("ul"));
	}

	listOutdent(sel) {
		let li = sel.anchorNode.parentNode.closest('li');     // to improve
		let lip;
		let toremove;

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
	}

	// merge same level siblings
	listSanitize(ul) {
		let li = ul.firstElementChild;
		while (li) {
			if ((li.style.listStyle=="none") && (li.nextElementSibling.style.listStyle=="none")) {
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
		if (event.keyCode === 9) {                    // tab key
			event.preventDefault();  // this will prevent us from tabbing out of the editor
		    let sel = event.target.ownerDocument.defaultView.getSelection();
			if (event.shiftKey) {
				this.listOutdent(sel);


			} else {
				this.listIndent(sel);

		        // <li>
		        // if (sel.isCollapsed) {                                              // only implement one node, for no
	        	/*
	        	{
	        		let tabContent = document.createTextNode("\u00a0\u00a0\u00a0\u00a0");
	        		range.insertNode(tabContent);
	        		range.setStartAfter(tabNode);
			        range.setEndAfter(tabNode); 
			        // sel.removeAllRanges();
			        // sel.addRange(range);
	        	}
	        	*/
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
		return undefined;
	}
	toDom() {
		this.dom.parentNode.replaceChild(this.vdom.cloneNode(true), this.dom);
	}
	fromDom() {

	}
	mutationApply(srcel, destel, records) {
		for (let record of records) {
			console.log(record);
			switch (record.type) {
				case "characterData": 
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
								return;
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



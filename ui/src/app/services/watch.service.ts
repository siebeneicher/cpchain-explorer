import { Injectable } from '@angular/core';
import { CookieService } from 'ngx-cookie-service';

@Injectable({
	providedIn: 'root'
})
export class WatchService {

	cookieKey:string = "cpc-watch-addresses";

	constructor(private cookieService: CookieService,) { }

	watching (addr = null) {
// TODO: cache
		let addrs = [];
		try {
			addrs = JSON.parse(this.cookieService.get(this.cookieKey));
			if (!addrs)
				addrs = [];
		} catch (e) {}

		if (addr)
			return addrs.includes(addr);

		return addrs;
	}

	toggle (addr) {
		if (!this.watching(addr)) {
			this._add(addr);
		} else {
			this._del(addr);
		}
	}

	_add (addr) {
		let _ = <Array<any>> this.watching();
		_.push(addr);
		this.cookieService.set(this.cookieKey, JSON.stringify(_), 365);
	}

	_del (addr) {
		if (this.watching(addr)) {
			let _ = <Array<any>> this.watching();
			_.splice(_.indexOf(addr), 1);
			this.cookieService.set(this.cookieKey, JSON.stringify(_), 365);
		}
	}
}

import { Injectable } from '@angular/core';

import { HttpClient } from '@angular/common/http';
import { ActivatedRoute } from "@angular/router";
import { environment } from '../../environments/environment';
import { Router } from '@angular/router';

@Injectable({
  providedIn: 'root'
})
export class LastBlockService {

	reloadLastBlock_interval:number = 3500;
	public last_block:any = {};

	constructor (
		private httpClient: HttpClient,
		private route: ActivatedRoute,
		private router: Router
	) {
		this.reload();

		setInterval(() => {
			this.reload()
		}, this.reloadLastBlock_interval);
	}

	reload () {
		let url = environment.backendBaseUrl + '/block/last';

		this.httpClient.get(url).subscribe((data: any) => {
			this.last_block = data;
		});
	}
}

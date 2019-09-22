import { Component, OnInit, OnDestroy } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { DateAgoPipe } from '../../pipes/date-ago.pipe';
import { environment } from '../../../environments/environment';
import { ActivatedRoute } from "@angular/router";


@Component({
  selector: 'app-address-transactions',
  templateUrl: './address-transactions.component.html',
  styleUrls: ['./address-transactions.component.scss']
})
export class AddressTransactionsComponent implements OnInit {

	addr:string;
	loading:boolean = false;
	loaded:boolean = false;
	data:Array<any>;
	steps:number = 50;
	sort:string;
	sortOrder:number;

	constructor(
		private httpClient: HttpClient,
		private dateAgo: DateAgoPipe,
		private route: ActivatedRoute,
	) {
		this.route.parent.params.subscribe(async (params) => {
			this.addr = params.addr;
			this.data = [];
			this.sort = "blockNumber";
			this.sortOrder = -1;
			this.loaded = false;
			this.load(this.steps);
		});
	}

	ngOnInit() {
	}

	async load (steps = -1) {
		this.loading = true;

		let url = environment.backendBaseUrl + '/address/transactions/' + this.addr;

		url += `?offset=${this.data.length}&limit=${steps}&sort=${this.sort}&sortOrder=${this.sortOrder}`;

		return new Promise((resolve, reject) => {
			return this.httpClient.get(url).subscribe((res: any) => {
				if (res) {
					Array.prototype.push.apply(this.data, <Array<any>> res);

					// unique list
					this.data = Array.from(new Set(this.data.map(a => a.hash)))
						.map(hash => {
							return this.data.find(a => a.hash === hash)
						})
				}
				this.loading = false;
				this.loaded = true;
				resolve();
			});
		});
	}

	showMore () {
		this.load(this.steps);
	}

	showAll (what) {
		this.load();
	}
}

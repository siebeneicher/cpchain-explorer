import { Component, OnInit, OnDestroy, ChangeDetectorRef, ChangeDetectionStrategy } from '@angular/core';
import { FormControl, FormGroupDirective, NgForm, Validators } from '@angular/forms';
import { Location } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { DateAgoPipe } from '../pipes/date-ago.pipe';
import { ConvertTsPipe } from '../pipes/convert-ts.pipe';
import { ConvertCpcPipe } from '../pipes/convert-cpc.pipe';
import { environment } from '../../environments/environment';
import { CookieService } from 'ngx-cookie-service';
import { KpiService } from '../kpi.service';
import { ActivatedRoute } from "@angular/router";

@Component({
	selector: 'app-address',
	templateUrl: './address.component.html',
	styleUrls: ['./address.component.scss'],
	providers: [DateAgoPipe, ConvertTsPipe, ConvertCpcPipe]
})
export class AddressComponent implements OnInit {

	addr:string;
	info:any = {};
	transactions:Array<any>;
	blocks:Array<any>;
	invalidAddress:boolean = false;
	loadingTrx:boolean = false;
	loadingBlocks:boolean = false;
	trx_limit:number;
	blocks_limit:number;
	submenu:string = "trxs";

	constructor (
		private httpClient: HttpClient,
		private ref: ChangeDetectorRef,
		private dateAgo: DateAgoPipe,
		private convertTs: ConvertTsPipe,
		private cookieService: CookieService,
		public kpi: KpiService,
		private route: ActivatedRoute,
		private location: Location
	) {
		this.route.params.subscribe(async (params) => {
			this.addr = params.addr;
			this.transactions = null;
			this.blocks = null;
			this.info = {};
			this.trx_limit = 15;
			this.blocks_limit = 15;
			this.invalidAddress = false;
			await this.load();
			setTimeout(() => {
				this.loadTrxs();
			}, 200);
			setTimeout(() => {
				this.loadBlocks();
			}, 450);
		});
	}

	ngOnInit() {
	}

	async load () {
		let url = environment.backendBaseUrl + '/address/' + this.addr;

		return new Promise((resolve, reject) => {
			return this.httpClient.get(url).subscribe(res => {
				let addr = <any> res;

				if (addr.invalidAddress) {
					this.invalidAddress = true;
					resolve();
					return;
				}

				this.invalidAddress = false;
				this.info = addr;

				resolve();
			});
		});
	}

	async loadTrxs () {
		this.loadingTrx = true;
		let url = environment.backendBaseUrl + '/address/transactions/' + this.addr;

		return new Promise((resolve, reject) => {
			return this.httpClient.get(url).subscribe((res: any) => {
/*				if (res.empty || res.err) {
// TODO show error
					return;
				}*/

				this.transactions = res && res.transactions ? <Array<any>> res.transactions : [];
				this.loadingTrx = false;
				resolve();
			});
		});
	}

	async loadBlocks () {
		this.loadingBlocks = true;
		let url = environment.backendBaseUrl + '/rnodes/blocks/' + this.addr;

		return new Promise((resolve, reject) => {
			return this.httpClient.get(url).subscribe((res: any) => {
/*				if (res.empty || res.err) {
// TODO show error
					return;
				}*/

				this.blocks = res ? <Array<any>> res : [];
				this.loadingBlocks = false;
				resolve();
			});
		});
	}

	setSubmenu (to) {
		this.submenu = to;

/*		if (to == 'trxs') this.loadTrxs();
		if (to == 'blocks') this.loadBlocks();*/
	}

	showMore (what) {
		this[what] += 15;
	}

	showAll (what) {
		this[what] = this.transactions.length;
	}
}

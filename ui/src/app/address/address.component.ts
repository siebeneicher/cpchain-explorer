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
	transactions:Array<any> = [];
	invalidAddress:boolean = false;

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
			this.transactions = [];
			this.info = {};
			await this.load();

			setTimeout(() => this.loadTrxs(), 500);
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
		let url = environment.backendBaseUrl + '/address/transactions/' + this.addr;

		return new Promise((resolve, reject) => {
			return this.httpClient.get(url).subscribe(res => {
/*				if (res.empty || res.err) {
// TODO show error
					return;
				}*/

				this.transactions = <Array<any>> (<any> res).transactions;
				resolve();
			});
		});
	}

}

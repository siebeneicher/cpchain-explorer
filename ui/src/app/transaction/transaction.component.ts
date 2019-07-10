import { Component, OnInit, OnDestroy, ChangeDetectorRef, ChangeDetectionStrategy } from '@angular/core';
import { FormControl, FormGroupDirective, NgForm, Validators } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { DateAgoPipe } from '../pipes/date-ago.pipe';
import { ConvertTsPipe } from '../pipes/convert-ts.pipe';
import { environment } from '../../environments/environment';
import { CookieService } from 'ngx-cookie-service';
import { KpiService } from '../kpi.service';
import { ActivatedRoute } from "@angular/router";

@Component({
  selector: 'app-transaction',
  templateUrl: './transaction.component.html',
  styleUrls: ['./transaction.component.scss'],
  providers: [DateAgoPipe, ConvertTsPipe]
})
export class TransactionComponent implements OnInit {

	txHash:string;
	trx:any = {};

	constructor (
		private httpClient: HttpClient,
		private ref: ChangeDetectorRef,
		private dateAgo: DateAgoPipe,
		private convertTs: ConvertTsPipe,
		private cookieService: CookieService,
		public kpi: KpiService,
		private route: ActivatedRoute
	) {
		this.txHash = this.route.snapshot.paramMap.get("txHash");
	}

	ngOnInit() {
		this.load();
	}

	async load () {
		let url = environment.backendBaseUrl + '/trx/' + this.txHash;

		return new Promise((resolve, reject) => {
			return this.httpClient.get(url).subscribe(res => {
				this.trx = res;
				resolve();
			});
		});
	}
}

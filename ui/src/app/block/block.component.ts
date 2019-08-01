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
  selector: 'app-block',
  templateUrl: './block.component.html',
  styleUrls: ['./block.component.scss'],
  providers: [DateAgoPipe, ConvertTsPipe]
})
export class BlockComponent implements OnInit {

	number:number;
	block:any = {};
	transactions:Array<any> = [];
	loadingTrx:boolean = false;
	impeached:boolean = false;
	impeached_proposer:string;

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
			this.number = parseInt(params.number);
			await this.loadBlock();
			this.loadTransactions();
		});
	}

	ngOnInit() {
	}

	async loadBlock () {
		let url = environment.backendBaseUrl + '/block/' + this.number;

		return new Promise((resolve, reject) => {
			return this.httpClient.get(url).subscribe(res => {
				this.block = res;
				this.impeached = environment.impeached_hash == this.block.miner;
				if (this.impeached && this.block.__generation)
					this.impeached_proposer = this.block.__generation.Proposers[this.block.__generation.ProposerIndex];
				resolve();
			});
		});
	}

	async loadTransactions () {
		this.loadingTrx = true;
		let url = environment.backendBaseUrl + '/block/transactions/' + this.number;

		return new Promise((resolve, reject) => {
			return this.httpClient.get(url).subscribe(res => {
				this.transactions = <Array<any>> res;
				this.loadingTrx = false;
				resolve();
			});
		});
	}

	ago (ts) {
		return this.dateAgo.transform(this.convertTs.transform(ts, 13));
	}
}

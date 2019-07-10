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
  selector: 'app-block',
  templateUrl: './block.component.html',
  styleUrls: ['./block.component.scss'],
  providers: [DateAgoPipe, ConvertTsPipe]
})
export class BlockComponent implements OnInit {

	number:number;
	block:any = {};

	constructor (
		private httpClient: HttpClient,
		private ref: ChangeDetectorRef,
		private dateAgo: DateAgoPipe,
		private convertTs: ConvertTsPipe,
		private cookieService: CookieService,
		public kpi: KpiService,
		private route: ActivatedRoute
	) {
		this.number = parseInt(this.route.snapshot.paramMap.get("number"));
	}

	ngOnInit() {
		this.loadBLock();
	}

	async loadBLock () {
		let url = environment.backendBaseUrl + '/block/' + this.number;

		return new Promise((resolve, reject) => {
			return this.httpClient.get(url).subscribe(res => {
				this.block = res;
				resolve();
			});
		});
	}
}

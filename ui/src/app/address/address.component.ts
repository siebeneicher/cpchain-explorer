import { Component, OnInit, OnDestroy, ChangeDetectorRef, ChangeDetectionStrategy } from '@angular/core';
import { FormControl, FormGroupDirective, NgForm, Validators } from '@angular/forms';
import { Location } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { DateAgoPipe } from '../pipes/date-ago.pipe';
import { ConvertTsPipe } from '../pipes/convert-ts.pipe';
import { environment } from '../../environments/environment';
import { CookieService } from 'ngx-cookie-service';
import { KpiService } from '../kpi.service';
import { ActivatedRoute } from "@angular/router";

@Component({
  selector: 'app-address',
  templateUrl: './address.component.html',
  styleUrls: ['./address.component.scss'],
  providers: [DateAgoPipe, ConvertTsPipe]
})
export class AddressComponent implements OnInit {

	addr:string;
	info:any = {};

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
		this.route.params.subscribe((params) => {
			this.addr = params.addr;
			this.load();
		});
	}

	ngOnInit() {
	}

	async load () {
		let url = environment.backendBaseUrl + '/address/' + this.addr;

		return new Promise((resolve, reject) => {
			return this.httpClient.get(url).subscribe(res => {
				this.info = res;
				resolve();
			});
		});
	}

}

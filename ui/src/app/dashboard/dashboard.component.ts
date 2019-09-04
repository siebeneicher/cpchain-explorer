import { Component, OnInit, OnDestroy, ChangeDetectorRef, ChangeDetectionStrategy, ElementRef } from '@angular/core';
import { FormControl, FormGroupDirective, NgForm, Validators } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { DateAgoPipe } from '../pipes/date-ago.pipe';
import { ConvertTsPipe } from '../pipes/convert-ts.pipe';
import { environment } from '../../environments/environment';
import { CookieService } from 'ngx-cookie-service';
import { KpiService } from '../kpi.service';
import { LastBlockService } from '../services/last-block.service';
import { SearchService } from '../services/search.service';
import { Router } from '@angular/router';


@Component({
	selector: 'app-dashboard',
	templateUrl: './dashboard.component.html',
	styleUrls: ['./dashboard.component.scss'],
	changeDetection: ChangeDetectionStrategy.OnPush,
	providers: [ DateAgoPipe, ConvertTsPipe ]
})
export class DashboardComponent implements OnInit {
	dashboard_data:any = null;
	user_rnodes:Array<any> = [];

	constructor (
		private httpClient: HttpClient,
		private router: Router,
		private ref: ChangeDetectorRef,
		private dateAgo: DateAgoPipe,
		private convertTs: ConvertTsPipe,
		private cookieService: CookieService,
		public kpi: KpiService,
		public lastBlockService: LastBlockService,
		public searchService: SearchService,
		private elementRef: ElementRef
	) {
		setInterval(() => {
			this.tick();
		}, 500);

		setInterval(() => {
			this.updateUserRnodes();
		}, 25);
	}

	ngOnInit () {
		this.kpi.require('dashboard');
	}
	ngOnDestroy () {
		this.kpi.unrequire('dashboard');
	}

	updateUserRnodes () {
		this.user_rnodes = [];

		try {
			this.user_rnodes = <Array<any>> JSON.parse(this.cookieService.get(environment.dashboardUserRnodeFavorites));
		} catch (e) {
			this.cookieService.set(environment.dashboardUserRnodeFavorites, JSON.stringify([]));
		}
	}

	tick () {
		this.ref.markForCheck();
	}

	ago (ts) {
		return this.dateAgo.transform(this.convertTs.transform(ts, 13));
	}

	async search () {
		let input = <HTMLInputElement> this.elementRef.nativeElement.querySelector('.app-search-input');
		let goTo = <Array<any>> await this.searchService.search(input.value);
		input.value = "";
		this.router.navigate(goTo);
	}
}

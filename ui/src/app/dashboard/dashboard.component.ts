import { Component, OnInit, OnDestroy, ChangeDetectorRef, ChangeDetectionStrategy } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { DateAgoPipe } from '../pipes/date-ago.pipe';
import { ConvertTsPipe } from '../pipes/convert-ts.pipe';
import { environment } from '../../environments/environment';
import { CookieService } from 'ngx-cookie-service';
import { KpiService } from '../kpi.service';

@Component({
	selector: 'app-dashboard',
	templateUrl: './dashboard.component.html',
	styleUrls: ['./dashboard.component.scss'],
	changeDetection: ChangeDetectionStrategy.OnPush,
	providers: [ DateAgoPipe, ConvertTsPipe ]
})
export class DashboardComponent implements OnInit {
	user_rnode_data:Object;
	dashboard_data:any = null;
	latestRelease:any = {};

	COOKIE_USER_RNODE:string = "cpc-user-rnode-favorite";		// todo: env.

	constructor (
		private httpClient: HttpClient,
		private ref: ChangeDetectorRef,
		private dateAgo: DateAgoPipe,
		private convertTs: ConvertTsPipe,
		private cookieService: CookieService,
		public kpi: KpiService
	) {
		setInterval(() => {
			this.tick();
		}, 500);
	}

	ngOnInit () {
// FOR TESTING ONLY
this.cookieService.set(this.COOKIE_USER_RNODE, '0x501f6cf7b2437671d770998e3b785474878fef1d');

		this.kpi.require('dashboard');
		if (this.userRNode())
			this.kpi.require('myrnode', {addr: this.userRNode()});

		this.loadReleases();
		setInterval(() => {
			this.loadReleases();
		}, 1000 * 60 * 5);
	}
	ngOnDestroy () {
		this.kpi.unrequire('dashboard');
		this.kpi.unrequire('myrnode');
	}

	tick () {
		this.ref.markForCheck();
	}

	userRNode () {
		return this.cookieService.get(this.COOKIE_USER_RNODE);
	}

	ago (ts) {
		return this.dateAgo.transform(this.convertTs.transform(ts, 13));
	}

	loadReleases () {
		this.httpClient.get(environment.githubCPChainReleasesAPIUrl).subscribe(res => {
			if (!res) return;
			this.latestRelease = res[0];
		});
	}

}

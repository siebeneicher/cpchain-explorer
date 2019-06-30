import { Component, OnInit, ChangeDetectorRef, ChangeDetectionStrategy } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { DateAgoPipe } from '../pipes/date-ago.pipe';
import { ConvertTsPipe } from '../pipes/convert-ts.pipe';
import { environment } from '../../environments/environment';
import { CookieService } from 'ngx-cookie-service';

@Component({
	selector: 'app-dashboard',
	templateUrl: './dashboard.component.html',
	styleUrls: ['./dashboard.component.scss'],
	changeDetection: ChangeDetectionStrategy.OnPush,
	providers: [ DateAgoPipe, ConvertTsPipe ]
})
export class DashboardComponent implements OnInit {
	units:Array<any> = ['hour','day','month'];
	user_rnode_data:Object;
	dashboard_data:any = null;
	latestRelease:any = {};
	userRNodeAddr:string;
	kpi_selections:any = {};
	kpi_defaults:any = {};
	kpi_options:any = {};

	COOKIE_USER_RNODE:string = "cpc-user-rnode-favorite";		// todo: env.

	constructor (
		private httpClient: HttpClient,
		private ref: ChangeDetectorRef,
		private dateAgo: DateAgoPipe,
		private convertTs: ConvertTsPipe,
		private cookieService: CookieService
	) {
		setInterval(() => {
			this.tick();
		}, 500);
	}

	ngOnInit () {
		this.reload();
		this.loadReleases();
		this.loadUserRNode();

		setInterval(() => {
			this.reload();
			this.loadUserRNode();
		}, 1000);

		setInterval(() => {
			this.loadReleases();
		}, 1000 * 60 * 5);

		this.kpi_defaults = {
			last_rewards: {
				total_roi_year: {'dashboard.rewards': 'year'},
				total_rewards: {'dashboard.rewards': 'year'}
			}
		};
	}
	tick () {
		this.ref.markForCheck();
	}
	reload () {
		this.loadDashboard();
	}
	loadDashboard () {
		this.httpClient.get(environment.backendBaseUrl+'/dashboard').subscribe(res => {
			this.dashboard_data = res;
		});
	}

	loadUserRNode () {
		this.userRNodeAddr = this.cookieService.get(this.COOKIE_USER_RNODE);

		if (!this.userRNodeAddr) return;

		// load rnode data from backend
		this.httpClient.get(environment.backendBaseUrl+`/rnode/user/${this.userRNodeAddr}`).subscribe(res => {
			this.user_rnode_data = res;
		});
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

	// TODO: make it a service

	kpiDefaultUnit (kpi_key, subset, ui_key) {
		return this.kpi_defaults[kpi_key][subset][ui_key];
	}
	kpiSelectUnit (kpi_key, subset, ui_key, selected_unit) {
		if (!this.kpi_selections[kpi_key]) this.kpi_selections[kpi_key] = {};
		if (!this.kpi_selections[kpi_key][subset]) this.kpi_selections[kpi_key][subset] = {};
		if (!this.kpi_selections[kpi_key][subset][ui_key]) this.kpi_selections[kpi_key][subset][ui_key] = {};
		this.kpi_selections[kpi_key][subset][ui_key] = selected_unit;
	}
	kpiUnitSelected (kpi_key, subset, ui_key) {
		try {
			return this.kpi_selections[kpi_key][subset][ui_key];
		} catch (e) {
			return this.kpiDefaultUnit(kpi_key, subset, ui_key);
		}
	}
	kpiData (kpi_key, subset, ui_key) {
		return this._kpi(kpi_key, subset, ui_key).data[subset];
	}
	kpiOptions (kpi_key) {
		if (this.kpi_options[kpi_key]) return this.kpi_options[kpi_key];

		return this.kpi_options[kpi_key] = Object.entries(this.dashboard_data[kpi_key]).map(_ => {
			return Object.assign({unit: _[0]}, _[1].option);
		});
	}
	kpiSelectedOption (kpi_key, subset, ui_key) {
		let unit = this.kpiUnitSelected(kpi_key, subset, ui_key);
		return this.kpi_options[kpi_key].filter(_ => _.unit == unit)[0];
	}
	_kpi (kpi_key, subset, ui_key) {
		let unit_selected;
		try {
			unit_selected = this.kpi_selections[kpi_key][subset][ui_key];
		} catch (e) {
			// no individual selection made yet, so we deliver default
			unit_selected = this.kpiDefaultUnit(kpi_key, subset, ui_key);
		}
		return this.dashboard_data[kpi_key][unit_selected];
	}

}

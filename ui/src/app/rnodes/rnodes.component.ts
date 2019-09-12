import { Component, OnInit } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../environments/environment';
import { WatchService } from '../services/watch.service';
import { RnodeMinedGraphComponent } from '../rnode-mined-graph/rnode-mined-graph.component';

@Component({
	selector: 'app-rnodes',
	templateUrl: './rnodes.component.html',
	styleUrls: ['./rnodes.component.scss']
})
export class RnodesComponent implements OnInit {

	unit:string = "hour";
	times:number = 24;
	sortBy:string = "elected";
	sortOrder:number = -1;
	loading:string;
	loadInterval:number = 3000000;
	loadPromise:any;
	filtered:Array<any> = [];
	rnodes:Array<any> = [];
	stats:any = {};
	showVisLine:string = "sealed";
	width_left:number = 0;
	width_right:number = 0;
	filter_community_only:boolean;

	constructor(private httpClient: HttpClient, public watchService: WatchService,) { }

	ngOnInit() {
		this.stats = {};
		this.filter_community_only = false;
		this.loadPromise = Promise.resolve();
		this.load();
		setInterval(() => this.load(), this.loadInterval);
	}

	sort () {
		// 1st. by sealed (primite sort by this.sortBy, minied)
		if (this.sortBy != "mined")
			this.filtered.sort((a,b) => (a["mined"] > b["mined"]) ? 1*-1 : ((b["mined"] > a["mined"]) ? -1*-1 : 0));

		// 2nd. by user choice
		this.filtered.sort((a,b) => (a[this.sortBy] > b[this.sortBy]) ? 1*this.sortOrder : ((b[this.sortBy] > a[this.sortBy]) ? -1*this.sortOrder : 0));
	}

	clickSort (by) {
		if (this.sortBy == by) {
			this.sortOrder = this.sortOrder * -1;
		} else {
			this.sortBy = by;
		}

		this.sort();
		this.calcTableWidths();
	}

	filter () {
		if (!this.filter_community_only)
			this.filtered = this.rnodes;
		else
			this.filtered = this.rnodes.filter(_ => _.owned_by != "cpchain");

		this.calcStats();
	}

	calcTableWidths () {
		setTimeout(() => _calc(), 25);
		setTimeout(() => _calc(), 155);

		let _this = this;

		function _calc () {
			_this.width_left = 0;
			["pos","address","owned","balance","rpt","elected","roi"].forEach(_ => {
				_this.width_left += document.querySelector('table.rnodes th.'+_).clientWidth;
			});

			_this.width_right = 0;
			["sealed","impeached","rewards","graph"].forEach(_ => {
				_this.width_right += document.querySelector('table.rnodes th.'+_).clientWidth;
			});
		}
	}

	calcStats () {
		this.stats = {
			mined_max: 0,
			rpt_max: 0,
		};

		this.filtered.forEach(_ => {
			this.stats.mined_max = Math.max(this.stats.mined_max, _.mined);
			this.stats.rpt_max = Math.max(this.stats.rpt_max, _.rpt);
		});
	}

	setTimespan (unit, times) {
		this.unit = unit;
		this.times = times;
		this.load();
	}

	toggleCommunityOnly () {
		this.filter_community_only = !this.filter_community_only;
		this.filter();
		this.sort();
		this.calcTableWidths();
	}

	async load () {
		let _this = this;
		let url = environment.backendBaseUrl + '/rnodes/'+this.unit+'/'+this.times;
		this.loading = this.unit+'-'+this.times;

		// chain loads
		return this.loadPromise = this.loadPromise.then(_load);

		async function _load () {
			return _this.httpClient.get(url).subscribe((res: Array<any>) => {
				_this.rnodes = res;
				_this.filter();
				_this.sort();
				_this.loading = "";
				_this.calcTableWidths();
			});
		}
	}

}

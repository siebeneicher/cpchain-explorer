import { Component, OnInit } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../environments/environment';
import { WatchService } from '../services/watch.service';

@Component({
  selector: 'app-rnodes-roi-graph',
  templateUrl: './rnodes-roi-graph.component.html',
  styleUrls: ['./rnodes-roi-graph.component.scss']
})
export class RnodesRoiGraphComponent implements OnInit {

	unit:string = "hour";
	times:number = 24 * 7;
	loading:string;
	loadInterval:number = 10000;
	loadPromise:any;
	data:Array<any> = [];

	constructor(private httpClient: HttpClient, public watchService: WatchService,) {

	}

	ngOnInit() {
		this.data = [];
		this.loadPromise = Promise.resolve();
		this.load();
		//setInterval(() => this.load(), this.loadInterval);
	}

	async load () {
		let _this = this;
		let url = environment.backendBaseUrl + '/rnodes/roi/'+this.unit+'/'+this.times;
		this.loading = this.unit+'-'+this.times;

		// chain loads
		return this.loadPromise = this.loadPromise.then(_load);

		async function _load () {
			return _this.httpClient.get(url).subscribe((res: Array<any>) => {
				_this.data = res.data;
				_this.loading = "";
			});
		}
	}
}

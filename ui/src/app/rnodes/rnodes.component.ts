import { Component, OnInit } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../environments/environment';
import { WatchService } from '../services/watch.service';

@Component({
  selector: 'app-rnodes',
  templateUrl: './rnodes.component.html',
  styleUrls: ['./rnodes.component.scss']
})
export class RnodesComponent implements OnInit {

	unit:string = "day";
	times:number = 1;
	sortBy:string = "mined";
	sortOrder:number = -1;
	loading:string;

	rnodes:Array<any> = [];

	constructor(private httpClient: HttpClient, public watchService: WatchService,) { }

	ngOnInit() {
		this.load();
	}

	sort () {
		this.rnodes.sort((a,b) => (a[this.sortBy] > b[this.sortBy]) ? 1*this.sortOrder : ((b[this.sortBy] > a[this.sortBy]) ? -1*this.sortOrder : 0));
	}

	clickSort (by) {
		if (this.sortBy == by) {
			this.sortOrder = this.sortOrder * -1;
		} else {
			this.sortBy = by;
		}

		this.sort();
	}

	setTimespan (unit, times) {
		this.unit = unit;
		this.times = times;
		this.load();
	}

	async load () {
		let url = environment.backendBaseUrl + '/rnodes/'+this.unit+'/'+this.times;
		this.loading = this.unit+'-'+this.times;

		return new Promise((resolve, reject) => {
			return this.httpClient.get(url).subscribe((res: Array<any>) => {
				this.rnodes = res;
				this.sort();
				this.loading = "";
				resolve();
			});
		});
	}

}

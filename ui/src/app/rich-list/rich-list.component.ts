import { Component, OnInit, OnDestroy } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../environments/environment';
import { WatchService } from '../services/watch.service';

@Component({
	selector: 'app-rich-list',
	templateUrl: './rich-list.component.html',
	styleUrls: ['./rich-list.component.scss']
})
export class RichListComponent implements OnInit {

	addresses:Array<any> = [];
	loading:boolean = false;

	constructor(private httpClient: HttpClient, public watchService: WatchService,) { }

	ngOnInit() {
		this.load();
	}

	async load () {
		let url = environment.backendBaseUrl + '/addresses';

		this.loading = true;

		return new Promise((resolve, reject) => {
			return this.httpClient.get(url).subscribe((res: Array<any>) => {
				this.addresses = res;
				this.loading = false;
				resolve();
			});
		});
	}
}

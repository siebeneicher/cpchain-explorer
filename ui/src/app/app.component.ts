import { Component, OnInit } from '@angular/core';
import { HttpClient } from '@angular/common/http';

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.scss']
})
export class AppComponent implements OnInit {
	rnode_addr:String = '0x6026ab99f0345e57c7855a790376b47eb308cb40';
	rnode_data:Object;
	baseUrl:String = "http://localhost:8080";
	dashboard_data:Object = {};

	timespan:Object = { from: 1551398400 * 1000, to: 1561939200 * 1000};

	constructor (private httpClient: HttpClient) {}

	ngOnInit () {

		//this.rnode_addr = '0x28e8fbacc91e01d5f111017c0fc969334c7fde87';
		this.loadOverview();
		this.loadRNodeStats();
	}

	loadOverview () {
	    this.httpClient.get(this.baseUrl+'/dashboard').subscribe(res => {
	    	this.dashboard_data = res;
	    });
	}

	loadRNodeStats () {
	    this.httpClient.get(this.baseUrl+'/rnode?rnode='+this.rnode_addr).subscribe(res => {
	    	this.rnode_data = res;
	    });
	}
}

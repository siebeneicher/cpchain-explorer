import { Component, OnInit, OnDestroy, Input, ViewChild, ElementRef } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../environments/environment';
import { ActivatedRoute } from "@angular/router";
import { DataApiService } from '../data-api.service';
import * as d3 from 'd3';
import * as moment from 'moment';

@Component({
  selector: 'app-rnode-mined-graph',
  templateUrl: './rnode-mined-graph.component.html',
  styleUrls: ['./rnode-mined-graph.component.scss']
})
export class RnodeMinedGraphComponent implements OnInit {

	loading:boolean = false;
	loaded:boolean = false;
	data:Array<any>;
	filtered:Array<any>;
	filter_select:string = "5-days";

	width:number;
	height:number;

	filters:any = {
		"5-days": {unit: 'day', times: 7},
	};

	ts_start:any = "latest";

	@ViewChild('container', {static: false}) container:ElementRef;
	@ViewChild('graph', { static: false }) graph:ElementRef;
	@Input() addr:string;
	@Input() index:number;

	constructor(
		private httpClient: HttpClient,
		private route: ActivatedRoute,
		public dataApiService: DataApiService,
	) {
	}

	ngOnInit() {
		this.data = [];
		this.filtered = [];
		this.loaded = false;

		//setTimeout(() => this.setFilter(this.filter_select), this.index * 30);
		this.setFilter(this.filter_select);
	}

	async load () {
		this.loading = true;

		return this.dataApiService.rnodeTimeline(this.addr).then((res: any) => {
			this.data = res ? <Array<any>> res : [];
			this.loading = false;
			this.loaded = true;
			setTimeout(() => this.render(), 15);
		});
	}

	prepareDataset () {
		let max = 0;
		let min = null;

		let dataset = this.data;

		this.data.forEach(_ => {
			max = Math.max(_.mined, max);
			min = min === null ? _.mined : Math.min(min, _.mined);
		});

		// filter away, empty items from start to first non-empty
		let has = false;
		dataset = dataset.filter(_ => {
			if (has) return true;
			if (_.mined !== undefined) return has = true;
			return false;
		});

		return {dataset, max, min};
	}

	setFilter (to) {
		this.filter_select = to;
		this.load();
	}

	clear () {
		try {
			this.graph.nativeElement.removeChild(this.graph.nativeElement.childNodes[0]);
		} catch (e) {}
	}

	render () {
		this.clear();

		const unit = this.filters[this.filter_select].unit;
		const yFormat = unit == "day" ? 'dd' : 'HH';

		const {dataset, max, min} = this.prepareDataset();
		const container = this.container.nativeElement;
		//const computed = window.getComputedStyle(container);

		const axisTicks = 5;
		const margin = {top: 0, right: 0, bottom: 0, left: 0};
		this.width = container.clientWidth - margin.left - margin.right;	 // Use the prrents's width 
		this.height = container.clientHeight - margin.top - margin.bottom;	 // Use the parents's height

		const svg = d3.select(this.graph.nativeElement).append("svg")
		    .attr("width", this.width + margin.left + margin.right)
		    .attr("height", this.height + margin.top + margin.bottom)
		  .append("g")
		    .attr("transform", "translate(" + margin.left + "," + margin.top + ")");

		const xScale = d3.scaleBand()
			.range([0, this.width])
			.domain(dataset.map((s) => s.ts))
			.padding(0.2)

		const yScale = d3.scaleLinear()
		    .domain([0, max]) // input 
		    .range([this.height, 0]); // output

		svg.selectAll('rect')
			.data(dataset)
			.enter()
			.append('rect')
			.attr('x', (s) => xScale(s.ts))
			.attr('y', (s) => yScale(s.mined))
			.attr('height', (s) => this.height - yScale(s.mined))
			.attr('width', xScale.bandwidth())
			.attr("fill", function(d) {
				return "rgb(33, 174, " + (255 * (max / d.mined - 1)) + ")";
			})
			.attr('class', 'bar');

	}

}

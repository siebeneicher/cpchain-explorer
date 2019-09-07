import { Component, OnInit, OnDestroy } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { DateAgoPipe } from '../../pipes/date-ago.pipe';
import { environment } from '../../../environments/environment';
import { ActivatedRoute } from "@angular/router";
import * as d3 from 'd3';
import * as moment from 'moment';

@Component({
  selector: 'app-address-analytics',
  templateUrl: './address-analytics.component.html',
  styleUrls: ['./address-analytics.component.scss']
})
export class AddressAnalyticsComponent implements OnInit {

	addr:string;
	loading:boolean = false;
	loaded:boolean = false;
	data:Array<any>;
	filtered:Array<any>;
	filter_select:string = "30-days";

	width:number;
	height:number;

	filters:any = {
		"24-hours": {unit: 'hour', times: 24},
		"48-hours": {unit: 'hour', times: 48},
		"7-days": {unit: 'day', times: 7},
		"30-days": {unit: 'day', times: 30},
		"all-days": {unit: 'day', times: -1},
	};

	ts_start:any = "latest";

	constructor(
		private httpClient: HttpClient,
		private dateAgo: DateAgoPipe,
		private route: ActivatedRoute,
	) {
		this.route.parent.params.subscribe(async (params) => {
			this.addr = params.addr;
			this.data = [];
			this.filtered = [];
			this.loaded = false;
			this.setFilter(this.filter_select);
		});
	}

	ngOnInit() {
	}

	async load () {
		this.loading = true;

		const f = this.filters[this.filter_select];
		let url = environment.backendBaseUrl + `/rnodes/timeline/${f.unit}/${f.times}/${this.ts_start}/${this.addr}`;

		return new Promise((resolve, reject) => {
			return this.httpClient.get(url).subscribe((res: any) => {
				this.data = res ? <Array<any>> res : [];
				this.loading = false;
				this.loaded = true;
				setTimeout(() => this.render(), 15);
				resolve();
			});
		});
	}

	prepareDataset () {
		let max = 0;
		let min = null;

		const dataset = this.data.map(({ts, rnodes}) => {
			const r = rnodes[this.addr];
			let b = {ts, mined: 0};
			if (!r) return b;
			b.mined = r.mined;
			max = Math.max(r.mined, max);
			min = min === null ? r.mined : Math.min(min, r.mined);
			return b;
		});

		return {dataset, max, min};
	}

	setFilter (to) {
		this.filter_select = to;
		this.load();
	}

	clear () {
		d3.select("#addr-rewards-graph > svg").remove();
	}

	render () {
		this.clear();

		const unit = this.filters[this.filter_select].unit;
		const yFormat = unit == "day" ? 'dd' : 'HH';

		const {dataset, max, min} = this.prepareDataset();
		const container = document.querySelector("#addr-rewards-container");
		//const computed = window.getComputedStyle(container);

		const axisTicks = 5;
		const margin = {top: 25, right: 25, bottom: 25, left: 25};
		this.width = container.clientWidth - margin.left - margin.right;	 // Use the prrents's width 
		this.height = container.clientHeight - margin.top - margin.bottom;	 // Use the parents's height

		const svg = d3.select("#addr-rewards-graph").append("svg")
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

		svg.append('g')
			.call(d3.axisLeft(yScale));

		svg.append("g")
			.attr("class", "x axis")
			.attr("transform", "translate(0," + (this.height) + ")")
			.call(d3.axisBottom(xScale).tickSize(10).ticks(axisTicks).tickFormat(d => moment.utc(d*1000).format(yFormat)))
			.select(".domain").remove()

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

		svg.selectAll()
			.data(dataset)
			.enter()
			.append("text")
			.text(d => d.mined)
			.attr("text-anchor", "middle")
			.attr("x", (d, i) => {
					return (i * ((this.width - 8) / dataset.length) + ((this.width - 8) / dataset.length - 5) / 2) + 5;
			})
			.attr("y", (d) => {
					return this.height - this.height * (d.mined / max) + 17;
			})
			.attr("font-family", "Open Sans")
			.attr("font-weight", "300")
			.attr("font-size", "11px")
			.attr("fill", "white");


		// https://www.visualcinnamon.com/2016/06/glow-filter-d3-visualization
		//Container for the gradients
		var defs = svg.append("defs");

		//Filter for the outside glow
		var filter = defs.append("filter")
		    .attr("id","glow");
		filter.append("feGaussianBlur")
		    .attr("stdDeviation","1.0")
		    .attr("result","coloredBlur");
		var feMerge = filter.append("feMerge");
		feMerge.append("feMergeNode")
		    .attr("in","coloredBlur");
		feMerge.append("feMergeNode")
		    .attr("in","SourceGraphic");

		svg.selectAll('.bar').style("filter", "url(#glow)");
	}

}

import { Component, OnInit } from '@angular/core';
import * as d3 from 'd3';
import * as moment from 'moment';
import { environment } from '../../../environments/environment';

@Component({
  selector: 'app-trx-streamgraph',
  templateUrl: './trx-streamgraph.component.html',
  styleUrls: ['./trx-streamgraph.component.scss']
})
export class TrxStreamgraphComponent implements OnInit {

	width:number = 1400;
	height:number = 600;
	svg:any;
	limit:number = 10;
	timerange:any;
	timeranges:Array<any> = [];

	unit:string;
	times:number;

	loading:number = -1;

	hover_tooltip:any;
	hovered_stream:string = "";
	mouse_x:number;
	mouse_y:number;


	constructor() { }

	ngOnInit() {
	}

	ngAfterContentInit() {
		this.timeranges = [
			{title: 'last day', unit: "hour", times: 24},
			{title: 'last week', unit: "hour", times: 24*7},
			{title: 'last month', unit: "day", times: 30},
			{title: 'last quarter', unit: "day", times: 31*3},
			{title: 'last year', unit: "week", times: 53},
			{title: 'last 3 days', unit: "hour", times: 3*24}
		];
		this.setTimerange(1);

	}
	ngAfterViewInit () {
		this.attachTooltipToDocument();
	}
	attachTooltipToDocument () {
		document.body.appendChild(document.querySelector(".stream-container-hovertooltip"));
		this.hover_tooltip = document.querySelector(".stream-container-hovertooltip");
	}
	setTimerange (index) {
		this.timerange = index;
		this.reload();
	}

	reload () {
		this.loading = this.timerange;
		const tr = this.timeranges[this.timerange];
		d3.json(environment.backendBaseUrl+'/rnodes-streamgraph?unit='+tr.unit+'&times='+tr.times).then(_ => this.render(_));
	}

	filter (res) {
		// filter to top 10
		let limit = 10;
		let max_total = 0;

		// sort, limit
		let rnodes_a = Object.entries(res.rnodes_sum);
		rnodes_a.sort((a,b) => <any>b[1] - <any>a[1]);

		// limit
		let columns = rnodes_a.splice(0, limit).map(_ => _[0]);

		// remove rnodes from data set
		res.data.forEach(row => {
			rnodes_a.forEach(_ => delete row[_[0]])

			let row_total = 0;
			columns.forEach(rnode => row_total += row[rnode]);

			if (max_total < row_total) max_total = row_total;
		});

		return {columns, data: res.data, max_total};
	}

	clear () {
		d3.select("#stream-container > svg").remove();
	}

	render (res) {

		this.clear();

		if (!res) {
// TODO: no data available

			this.loading = -1;
			return;
		}

		// List columns
		let {columns: keys, data, max_total} = this.filter(res);
		let axisTicks = 10;
		let base_opacity = 0.9;

		this.svg = d3.select("#stream-container")
			.append("svg")
			.attr('width', this.width)
			.attr('height', this.height)

		// Add X axis
		var x = d3.scaleLinear()
			.domain(d3.extent(data, function(d) { return d.ts; }))
			.range([ 0, this.width ]);

		this.svg.append("g")
			.attr("transform", "translate(0," + this.height*0.8 + ")")
			.call(d3.axisBottom(x).tickSize(-this.height*.7).ticks(axisTicks).tickFormat(d => moment.utc(d*1000).format('DD-MM HH:MM')+' (UTC)'))
			.select(".domain").remove()

		this.svg
			.selectAll(".tick text")
				.attr("y", 3)
				.attr("x", 7)
				.attr("dy", ".35em")
				.attr("transform", "rotate(45)")
				.style("text-anchor", "start")

		// Customization
		this.svg.selectAll(".tick line").attr("stroke", "#b8b8b8")

/*		// Add X axis label:
		this.svg.append("text")
			.attr("text-anchor", "end")
			.attr("x", this.width)
			.attr("y", this.height-30 )
			.text("Time (past hours)");
*/
		// Add Y axis
		var y = d3.scaleLinear()
			.domain([-max_total*1, max_total*1])
			.range([ this.height, 0 ]);

		// color palette
		var color = d3.scaleOrdinal()
			.domain(keys)
			.range(d3.schemeDark2);

		//stack the data?
		var stackedData = d3.stack()
			.offset(d3.stackOffsetSilhouette)
			.keys(keys)(data)

		// create a tooltip
		var Tooltip = this.svg
			.append("text")
			.attr("x", this.width/2 - 200)
			.attr("y", 30)
			.style("opacity", 0)
			.style("font-size", 17)

		// Three function that change the tooltip when user hover / move / leave a cell
		var mouseover = function(d) {
			//Tooltip.style("opacity", 1)
			d3.selectAll(".myArea").style("opacity", .35)
			d3.select(this)
				.style("stroke", "#666666")
				.style("opacity", 0.8)
		}
		var mousemove = (d,i) => {
			this.mouse_x = (window.event as MouseEvent).pageX, this.mouse_y = (window.event as MouseEvent).pageY;

// TODO: use a global moving tooltip
			if (d.key) {
				this.hover_tooltip.style.top = (this.mouse_y + 15) + 'px';
				this.hover_tooltip.style.left = (this.mouse_x + 15) + 'px';
				this.hovered_stream = d.key;
			}
		}
		var mouseleave = (d) => {
			d3.selectAll(".myArea").style("opacity", base_opacity).style("stroke", "none")
			this.hovered_stream = "";
		}

		// Area generator
		var area = d3.area()
			.x(function(d) { return x(d.data.ts); })
			.y0(function(d) { return y(d[0]); })
			.y1(function(d) { return y(d[1]); })

		// Show the areas
		this.svg
			.selectAll("mylayers")
			.data(stackedData)
			.enter()
			.append("path")
				.attr("class", "myArea")
				.style("fill", function(d) { return color(d.key); })
				.style("opacity", base_opacity)
				.attr("d", area)
				.on("mouseover", mouseover)
				.on("mousemove", mousemove)
				.on("mouseleave", mouseleave)

		// https://www.visualcinnamon.com/2016/06/glow-filter-d3-visualization
		//Container for the gradients
		var defs = this.svg.append("defs");

		//Filter for the outside glow
		var filter = defs.append("filter")
		    .attr("id","glow");
		filter.append("feGaussianBlur")
		    .attr("stdDeviation","2.5")
		    .attr("result","coloredBlur");
		var feMerge = filter.append("feMerge");
		feMerge.append("feMergeNode")
		    .attr("in","coloredBlur");
		feMerge.append("feMergeNode")
		    .attr("in","SourceGraphic");

		this.svg.selectAll('.myArea').style("filter", "url(#glow)");

		this.loading = -1;
	}
}

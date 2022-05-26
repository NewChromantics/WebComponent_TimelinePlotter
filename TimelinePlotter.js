//	web-component player
const ElementName = 'timeline-plotter';
export default ElementName;


//	get normalised Time between Min&Max
function Math_Range(Min,Max,Time)
{
	return (Time-Min) / (Max-Min);
}

const DefaultColours =
[
	[1,0,0,1],
	[1,1,0,1],
	[0,1,0,1],
	[0,1,1,1],
	[0,0,1,1],
	[1,0,1,1]
].map( rgba => rgba.map(x => x*255) ).reverse();

//	PopEngine/PromiseQueue.js
export function CreatePromise()
{
	let Callbacks = {};
	let PromiseHandler = function (Resolve,Reject)
	{
		Callbacks.Resolve = Resolve;
		Callbacks.Reject = Reject;
	}
	let Prom = new Promise(PromiseHandler);
	Prom.Resolve = Callbacks.Resolve;
	Prom.Reject = Callbacks.Reject;
	return Prom;
}


export class TimelinePlotter extends HTMLElement 
{
	constructor()
	{
		super();
		
		this.clear();
	}
	
	get TimelineDataDirty()
	{
		return this.TimelineDataChangesAll || (this.TimelineDataChanges.length>0);
	}
	
	static ElementName()	{	return ElementName;	}
	ElementName()			{	return TimelinePlotter.ElementName();	}
	
	static get observedAttributes() 
	{
		return ['css','showentrycount'];
	}
	
	get src()	{	return this.getAttribute('src');	}
	get css()	{	return this.getAttribute('css');	}
	
	get showentrycount()
	{
		//	getAttribute is also expensive! todo: cache it
		return false;
		return (this.getAttribute('showentrycount')||'').toLowerCase() == 'true';
	}
	
	GetCssContent()
	{
		const ImportCss = this.css ? `@import "${this.css}";` : '';
		const Css = `
		${ImportCss}
		
		:host
		{
			--MarkerX:	-99;
			--MarkerColour:	rgba(255,255,255,0.8);
			--MarkerWidth:	2px;
			--RowCount:	5;
			position:	relative;
			display:	block;
		}
		
		canvas
		{
			/* code sets canvas width for pixel-perfect alignment */
			--CanvasWidth:	100%;
			position:		absolute;
			top:			0px;
			left:			0px;
			xright:			0px;
			bottom:			0px;
			width:			var(--CanvasWidth);
			height:			100%;
			/* as we're scaling the canvas, pixellate the dots */
			image-rendering: pixelated;
		}
		
		#LabelContainer:before
		{
			content:		' ';
			position:		absolute;
			width:			var(--MarkerWidth);
			min-height:		10px;
			left:			calc( var(--MarkerX)*1px );
			top:			0px;
			bottom:			0px;
			background:		var(--MarkerColour);
			display:		inline-block;
		}
		
		#LabelContainer
		{
			position:	absolute;
			margin:		0px;
			top:		0px;
			left:		0px;
			right:		0px;
			bottom:		0px;
			display:	grid;
			grid-template-columns:	100%;
			xxbackground:	rgba(0,255,0,0.5);
			overflow:	hidden;
		}
		
		#LabelContainer div
		{
			--EntryCount:	'';
			xbackground:		rgba(0,0,0,0.5);
			
			color:			#fff;
			text-shadow:	0 0 2px black, 0 0 2px black, 0 0 2px black, 0 0 2px black;
			font-size:		8pt;
			font-family:	Arial, Helvetica, sans-serif;
			font-weight:	bold;
			
			/* hide overflow to stop affecting parent height*/
			overflow:		hidden;
			padding:		0.1em;
		}
		
		#LabelContainer[showentrycount=true] div:after
		{
			counter-reset:	EntryCount var(--EntryCount);
			content:		' (x' counter(EntryCount) ')';
		}
		`;
		return Css;
	}
	
	attributeChangedCallback(name, oldValue, newValue) 
	{
		//	todo: only update style if some css relative variables change
		if ( this.Style )
		{
			this.Style.textContent = this.GetCssContent();
		}

		if ( this.LabelContainer )
			this.LabelContainer.setAttribute('showentrycount',this.showentrycount);
	}
	
	connectedCallback()
	{
		//	move any children in the html onto our dom
		//	Create a shadow root
		this.Shadow = this.attachShadow({mode: 'open'});
		
		this.CreateDom(this.Shadow);
		
		//	initialise
		this.attributeChangedCallback();
		
		//	start render thread
		this.RenderThread().then(()=>console.warn(`RenderthreadFinished`));//.catch(console.error);
	}
	
	CreateDom(Parent)
	{
		this.CanvasElement = document.createElement('canvas');
		this.Style = document.createElement('style');

		this.LabelContainer = document.createElement('div');
		this.LabelContainer.id = 'LabelContainer';
		this.LabelElements = {};

		// attach the created elements to the shadow dom
		Parent.appendChild(this.Style);
		Parent.appendChild(this.CanvasElement);
		Parent.appendChild(this.LabelContainer);
	}
	
	GetTimeKeys()
	{
		const TimeKeys = Object.keys(this.TimelineTimes).map(Number).sort();
		return TimeKeys;
	}
	
	plot(Key,TimeMs)
	{
		this.TimelineTimes[TimeMs] = true;
		const NewRow = !this.TimelineData[Key];
		this.TimelineData[Key] = this.TimelineData[Key]||{};

		const NewData = !this.TimelineData[Key][TimeMs];
		this.TimelineData[Key][TimeMs] = true;	//	avoid duplicates by writing keys

		if ( NewRow || NewData )
			this.UpdateLabels();

		//	todo: write single pixel here?
		//	or keep a list of changes to write
		if ( NewData )
			this.TimelineDataChanges.push( [Key,TimeMs] );
	}
	
	setMarkerTime(TimeMs)
	{
		const TimeKeys = this.GetTimeKeys();
		//const Bitmap = this.GetDataBitmap();
		//const Width = Bitmap.width;
		//	same mapping of time/x -> pixel x as in UpdateDataBitmap()
		function TimeMsToX(TimeMs)
		{
			for ( let x=0;	x<TimeKeys.length;	x++ )
			{
				const xtime = TimeKeys[x];
				if ( xtime == TimeMs )
					return x;
				
				//	we've passed where we should be, so work out where we are between prev and this
				if ( xtime > TimeMs )
				{
					if ( x == 0 )
						return -1;
					
					let PrevTime = TimeKeys[x-1];
					let NextTime = TimeKeys[x];
					let Delta = Math_Range( PrevTime, NextTime, TimeMs );
					return (x-1)+Delta;
				}
			}
			return -1;
		}
		
		let MarkerX = TimeMsToX(TimeMs);
		
		function UpdateCss()
		{
			this.LabelContainer.style.setProperty(`--MarkerX`,MarkerX);
		}

		//	defer modifying dom until animation callback
		if ( this.LabelContainer )
		{
			requestAnimationFrame(UpdateCss.bind(this));
		}
	}

	clear()
	{
		this.TimelineData = {};	//	[Key] = [Time,Time,Time]
		this.TimelineTimes = {};	//	[Time] = null; record times for min/max etc
		this.TimelineDataChanges = [];	//	array of dirty data [Key,TimeMs]
		this.TimelineDataChangesAll = true;	//	all data needs redrawing
	}

	UpdateLabels()
	{
		const RowLabels = Object.keys( this.TimelineData );
		if ( this.LabelElements.length != RowLabels.length )
			this.Style.style.setProperty(`--RowCount`,RowLabels.length);
			
		function UpdateRowLabel(Label,Index)
		{
			let LabelElement = this.LabelElements[Index];
			if ( !this.LabelElements[Index] )
			{
				LabelElement = document.createElement('div');
				this.LabelContainer.appendChild(LabelElement);
				this.LabelElements[Index] = LabelElement;
				LabelElement.innerText = Label;
			}
	
			//	this causes a dom change,so can be expensive
			//	cache value, but will still be called a lot
			if ( this.showentrycount )
			{
				const RowEntryCount = Object.keys( this.TimelineData[Label] ).length;
				//	cache to try and reduce dom changes
				if ( LabelElement.EntryCount != RowEntryCount )
				{
					LabelElement.style.setProperty(`--EntryCount`,RowEntryCount);
					LabelElement.EntryCount = RowEntryCount;
				}
			}
		}
		RowLabels.forEach( UpdateRowLabel.bind(this) );
	}

	GetDataSize()
	{
		let Rows = Object.keys(this.TimelineData).length;
		//	cols should be maxtime - mintime / time step
		let Columns = Object.keys(this.TimelineTimes).length;
		
		const MinRows = 1;	//	until css is fixed
		const MinCols = 10;
		
		Rows = Math.max(Rows,MinRows);
		Columns = Math.max(Columns,MinCols);
		return [Columns,Rows];
	}

	GetDataBitmap()
	{
		const Dimensions = this.GetDataSize();
		
		//	check if dimensions changed
		if ( this.Bitmap )
		{
			if ( this.Bitmap.width != Dimensions[0] ||
				this.Bitmap.height != Dimensions[1] )
			{
				this.Bitmap = null;
			}
		}
		
		if ( !this.Bitmap )
		{
			//	dont specify data, let os alloc
			this.Bitmap = new ImageData(Dimensions[0], Dimensions[1] );
			this.TimelineDataChangesAll = true;
			
			//	seems to be all zero anyway
			//	but fill with zero-alpha
			//this.Bitmap.data.fill(0);
			
			//	reset canvas
			//	clear
			//	update canvas size so css scales it
			//	need to do something a bit smarter here when we want to zoom and scroll (in css ideally)
			//this.CanvasElement.width = this.Bitmap.width;
			//	gr: now we do dirty writes this size can get quite big without noticable perforamnce hits
			this.CanvasElement.width = 8000;
			this.CanvasElement.height = this.Bitmap.height;
			this.CanvasElement.style.setProperty('--CanvasWidth',`${this.CanvasElement.width}px`);
			const Context = this.GetCanvasContext();
			Context.fillStyle = "rgb(0, 0, 0, 0)";
			Context.fillRect(0, 0, this.CanvasElement.width, this.CanvasElement.height);
		}
		
		return this.Bitmap;
	}
	
	UpdateDataBitmap()
	{
		const Bitmap = this.GetDataBitmap();
		const Width = Bitmap.width;
		const Height = Bitmap.height;
		const Channels = 4;

		const Pixels = Bitmap.data;
		function WritePixel(x,y)
		{
			if ( x < 0 || x >= Width || y<0 || y>=Height )
				return;
			const PixelIndex = x + (y*Width);
			//const Colour = DefaultColours[PixelIndex%DefaultColours.length];
			const Colour = DefaultColours[y%DefaultColours.length];
			const DataIndex = PixelIndex*Channels;
			Pixels.set( Colour, DataIndex );
		}
		
		const TimeKeys = this.GetTimeKeys();
		function TimeMsToX(TimeMs)
		{
			let x = TimeKeys.indexOf(TimeMs);
			return x;
		}
		
		const Rows = this.TimelineData;
		if ( this.TimelineDataChangesAll )
		{
			for ( let r=0;	r<Object.keys(Rows).length;	r++ )
			{
				const Key = Object.keys(Rows)[r];
				const RowData = Rows[Key];
				for ( let TimeMs in RowData )
				{
					const y = r;
					const x = TimeMsToX( Number(TimeMs) );
					WritePixel(x,y);
				}
			}
		}
		else
		{
			for ( let [Key,TimeMs] of this.TimelineDataChanges )
			{
				let Row = Object.keys(Rows).indexOf(Key);
				const y = Row;
				const x = TimeMsToX(TimeMs);
				WritePixel(x,y);
			}
		}
		
		this.TimelineDataChangesAll = false;
		this.TimelineDataChanges = [];
		return Bitmap;
	}

	GetCanvasContext()
	{
		//	cache for speed
		if ( !this.CanvasContext )
		{
			const Context = this.CanvasElement.getContext('2d');
			this.CanvasContext = Context;
		}
		return this.CanvasContext;
	}

	UpdateCanvas()
	{
		if ( !this.CanvasElement )
			return;
		const Context = this.GetCanvasContext();
		const Bitmap = this.UpdateDataBitmap();

		//	blit the bitmap with no stretching.
		Context.putImageData( Bitmap, 0, 0 );
	}

	async RenderThread()
	{
		let PendingRenderPromise;
		function RenderCallback()
		{
			if ( PendingRenderPromise )
				PendingRenderPromise.Resolve();
			window.requestAnimationFrame(RenderCallback);
		}
		RenderCallback();
		async function WaitForRender()
		{
			if ( !PendingRenderPromise )
				PendingRenderPromise = CreatePromise();
			await PendingRenderPromise;
			PendingRenderPromise = null;
		}
	
		while ( true )
		{
			await WaitForRender();
			//	if dirty
			if ( this.TimelineDataDirty )
				this.UpdateCanvas();
		}
	}
}	

window.customElements.define( TimelinePlotter.ElementName(), TimelinePlotter );


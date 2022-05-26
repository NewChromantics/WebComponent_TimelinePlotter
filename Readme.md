```<timeline-plotter></timeline-plotter>

<script type=module>
const Plotter = document.querySelector(`timeline-plotter`);

function Plot(Key,TimeMs)
{
	Plotter.plot( Key, TimeMs );
}

function PlotLoop(Key,Interval)
{
	Plot( ...arguments );
	setTimeout( ()=> PlotLoop(...arguments), Interval );
}

PlotLoop(`Hello`,100);
PlotLoop(`World`,500);


</script>
```


/**
 * Copyright Kai Saksela 2014
 *
 * This program is free software: you can redistribute it and/or modify
    it under the terms of the GNU General Public License as published by
    the Free Software Foundation, either version 3 of the License, or
    (at your option) any later version.

    This program is distributed in the hope that it will be useful,
    but WITHOUT ANY WARRANTY; without even the implied warranty of
    MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
    GNU General Public License for more details.

    You should have received a copy of the GNU General Public License
    along with this program.  If not, see <http://www.gnu.org/licenses/>.
 */

var canvas = document.getElementById('lightning');
var plot = document.getElementById('plot');

//MAIN
(function() {
    var lightning, listener;
    var mouse_dragging = false;
    var lWorker = new Worker("js/lightning_worker.js");
    lWorker.addEventListener('message', function(e){lWorker_message(e);}, false);
    var progressBar = new ProgressBar("generator_progress", {'width':'200px', 'height':'3px'});
    $("#generator_progress").hide();

    var settings = {
        position: 2000,
        scale: 25.0,
        Fs: 22000,
        cs: 340.0,
        clip: true
    };

    function convolve(x,h)
    {
        var y = new Array(x.length + h.length - 1);
        for (var i = 0; i < y.length; i++ ) {
            y[i] = 0;
        }
        for (var i = 0; i < x.length; i++ )
        {
            //if(i % 1000 == 0)
            //    console.log((i/ y.length*100).toFixed(1) + "%");

            for (var j = 0; j < h.length; j++ )
            {
                y[i+j] += x[i] * h[j];    // convolve: multiply and accumulate
            }
        }
        return y;
    }

    /*
    function hanning(samples)
    {
        var s = new Array(samples);
        for(var i = 0; i < s.length; i++)
        {
            s[i] = 0.5*(1-Math.cos(2*Math.PI*i/(samples-1)));
        }
        return s;
    }*/
    function listen()
    {
        if(!this.thunder)
        {
            alert("You need to generate the thunder first!");
        }

        //Play sound
        //-------------
        var sound = new Array(this.thunder.length);
        for(var i = 0; i < this.thunder.length; i++)
        {
            sound[i] = this.thunder[i] * (settings.clip ? 2.0 : 1.0);
            if(Math.abs(sound[i]) > 1.0)
            {
                sound[i] = sound[i]/ Math.abs(sound[i]);
            }
            sound[i] = 32767*sound[i];
        }

        var audio = new Audio(); // create the HTML5 audio element
        var wave = new RIFFWAVE(); // create an empty wave file

        wave.header.sampleRate = settings.Fs;
        wave.header.numChannels = 1;
        wave.header.bitsPerSample = 16;
        wave.Make(sound); // make the wave file
        audio.src = wave.dataURI; // set audio source
        audio.play(); // we should hear two tones one on each speaker

    }

    function redraw()
    {

        var pts = lightning.main;
        var ctx = canvas.getContext('2d');
        var height = canvas.height;
        var scale = settings.scale;

        ctx.clearRect ( 0 , 0 , canvas.width, canvas.height );

        //Main
        ctx.beginPath();
        ctx.moveTo(pts[0].x / scale, height-pts[0].z / scale);
        for(var i = 1; i < pts.length; i++)
        {
            //ctx.arc(pts[i].x / scale, pts[i].z / scale, 2.0, 0, 2 * Math.PI, false);
            ctx.lineTo(pts[i].x / scale, height-pts[i].z / scale);
        }
        ctx.lineWidth = 40.0 / scale;
        ctx.strokeStyle = '#FCFDFF';
        ctx.stroke();

        //Branches

        for(var i = 0; i < lightning.branches.length; i++)
        {
            ctx.beginPath();
            var pts = lightning.branches[i];
            for(var j = 0; j < pts.length; j++)
            {
                ctx.lineTo(pts[j].x / scale, height-pts[j].z / scale);
            }
            ctx.lineWidth = 20.0 / scale;
            ctx.strokeStyle = '#ECEDEF';
            ctx.stroke();
        }

        //Top
        for(var i = 0; i < lightning.top.length; i++)
        {
            ctx.beginPath();
            var pts = lightning.top[i];
            for(var j = 0; j < pts.length; j++)
            {
                ctx.lineTo(pts[j].x / scale, height-pts[j].z / scale);
            }
            ctx.lineWidth = 20.0 / scale;
            ctx.strokeStyle = '#5C5D5F';
            ctx.stroke();
        }

        //Listener
        ctx.beginPath();
        ctx.moveTo(listener.x/scale,canvas.height);
        ctx.lineTo(listener.x/scale-(mouse_dragging ? 8 : 6),canvas.height-(mouse_dragging ? 10 : 7));
        ctx.lineTo(listener.x/scale+(mouse_dragging ? 8 : 6),canvas.height-(mouse_dragging ? 10 : 7));
        ctx.lineTo(listener.x/scale,canvas.height);
        ctx.fillStyle = '#DDDDFF';
        ctx.fill();
    }


    $(canvas).mousedown(function(event) {
        var mouse_pos = {x: event.pageX - $(this).offset().left, y: event.pageY - $(this).offset().top};

        console.log("Mouse down");
        mouse_dragging = true;
        listener.x = mouse_pos.x*settings.scale;
        $("#lightning_distance").text(Math.abs((listener.x-lightning.main[0].x)/1000).toFixed(2));
        redraw();
    });
    $(document).mouseup(function(event) {
        console.log("Mouse up");
        if(mouse_dragging)
        {
            mouse_dragging = false;
            redraw();
        }
    });
    $(canvas).mousemove(function(event) {
        if(mouse_dragging) {
            var mouse_pos = {x: event.pageX - $(this).offset().left, y: event.pageY - $(this).offset().top};

            if(mouse_pos.x > canvas.width || mouse_pos.x < 0)
                return;
            listener.x = mouse_pos.x*settings.scale;
            $("#lightning_distance").text(Math.abs(LightningGenerator.dist(listener,lightning.main[0])/1000).toFixed(2));
            redraw();
        }
    });

    $("#generate").click(function(){
        lightning = LightningGenerator.generate_lightning(2000,2000,4500,4500,0.025);
        redraw();
    });

    var lWorker_message = function(e)
    {
        if(e.data.process)
        {
            progressBar.setPercent(Math.round(e.data.process));
        }
        if(e.data.thunder)
        {
            //Add data
            this.thunder = e.data.thunder;

            //Plot waveform
            var plt = plot.getContext('2d');
            plt.clearRect(0,0,plot.width, plot.height);

            plt.beginPath();
            plt.moveTo(0,plot.height/2);
            for(var i = 1; i < this.thunder.length; i++)
            {
                plt.lineTo(i/this.thunder.length*plot.width,plot.height/2+plot.height/2*thunder[i]);
            }

            plt.strokeStyle = '#000000';
            plt.stroke();
            console.log("Done");

            $("#generate_thunder").show();
            $("#generator_progress").hide();
        }
    }
    $("#generate_thunder").click(function(){
        $("#generate_thunder").hide();
        $("#generator_progress").show();

        if(this.pts) delete this.pts;
        if(this.thunder) delete this.thunder;
        lWorker.postMessage({'lightning': lightning, 'listener': listener, 'settings': settings});

    });
    $("#listen").click(function(){
        listen();
    });

    if (canvas.getContext){
        lightning = LightningGenerator.generate_lightning(2000,2000,4500,4500,0.025);
        listener = {x: 3400, y: 2000, z: 0};
        $("#lightning_distance").text(Math.abs(LightningGenerator.dist(listener,lightning.main[0])/1000).toFixed(2));
        redraw();
    } else {
        alert("You need a better browser to run the lightning simulation!");
      // canvas-unsupported code here
    }
})();

// 同時発生音数(index.htmlの方に書いとく)
//var max_sound = 32;
//var partnum = 3;
//var show_oscscope = 1;

// for Synth
var AudioContext;
var audioCtx;
var osc_node;
var pan_node;
var gain_node;
var lfo_node;
var lfo_amount;
var filter_node;
var master_gain;
var amplfo_gain_node;
var lfo_pitch_gain_node;
var lfo_filter_gain_node;
var lfo_amp_gain_node;
var lfo_pan_gain_node;
var lfo_osc_node;
var manager;
var next_node = 0;

// for Analyser
var canvasCtx;
var analyser;
var bufferLength;
var dataArray;
var canvas_w;
var canvas_h;

// for MIDI
var midiAccess;
var inputs;
var input;
var outputs;
var output;

// for Controllers
var pitchbend = 0;
var modlever = 0;

// for portament
var start_note = 0;

$(function() {
	// 初期化処理

	// GUIの作成
	createUI();

	// for Web-audio
	AudioContext = window.AudioContext || window.webkitAudioContext;
	audioCtx = new AudioContext();
	manager = new Object(max_sound);
	for (i = 0; i < max_sound; i++) {
		manager[i] = new Object();
		manager[i]['using'] = false; // 鍵盤が押されていればtrue
		manager[i]['start_time'] = 0; // 発音時間
		manager[i]['notenum'] = 0; // MIDIノートナンバー
		manager[i]['partial'] = 0; // どのパーシャルか
		manager[i]['first_note'] = 0;
		manager[i]['first_time'] = 0;
		manager[i]['second_note'] = 0;
		manager[i]['second_time'] = 0;
		manager[i]['end_time'] = 0;
		manager[i]['start_note'] = 0;
		manager[i]['target_note'] = 0;
	}

	// for Synth
	master_gain = audioCtx.createGain();
	osc_node = new Object(max_sound);
	pan_node = new Object(max_sound);
	gain_node = new Object(max_sound);
	amplfo_gain_node = new Object(max_sound);
	filter_node = new Object(max_sound);

	// For lfo
	lfo_pitch_gain_node = new Object(max_sound);
	lfo_filter_gain_node = new Object(max_sound);
	lfo_amp_gain_node = new Object(max_sound);
	lfo_osc_node = new Object(max_sound);

	for (i = 0; i < max_sound; i++) {
		// 作成
		osc_node[i] = audioCtx.createOscillator();
		pan_node[i] = audioCtx.createPanner();
		pan_node[i].panningModel = 'equalpower';
		filter_node[i] = audioCtx.createBiquadFilter();
		gain_node[i] = audioCtx.createGain();
		gain_node[i].gain.value = 0;
	
		amplfo_gain_node[i] = audioCtx.createGain();
		lfo_pitch_gain_node[i] = audioCtx.createGain();
		lfo_filter_gain_node[i] = audioCtx.createGain();
		lfo_amp_gain_node[i] = audioCtx.createGain();
		lfo_osc_node[i] = audioCtx.createOscillator();

		// 接続
		osc_node[i].connect(pan_node[i]);
		pan_node[i].connect(gain_node[i]);
		gain_node[i].connect(amplfo_gain_node[i]);
		amplfo_gain_node[i].connect(filter_node[i]);
		filter_node[i].connect(master_gain);

		// pitch lfo
		lfo_osc_node[i].connect(lfo_pitch_gain_node[i]);
		lfo_pitch_gain_node[i].connect(osc_node[i].frequency);

		// amp lfo
		lfo_osc_node[i].connect(lfo_amp_gain_node[i]);
		lfo_amp_gain_node[i].connect(amplfo_gain_node[i].gain);

		// filter lfo
		lfo_osc_node[i].connect(lfo_filter_gain_node[i]);
		lfo_filter_gain_node[i].connect(filter_node[i].frequency);

		// スタート
		osc_node[i].start(0);
		lfo_osc_node[i].start(0);
	}
	master_gain.connect(audioCtx.destination);

	if (show_oscscope == 1) {
		// オシロスコープ表示
		canvasCtx = $('#osc_scope')[0].getContext('2d');
		analyser = audioCtx.createAnalyser();
		analyser.fftSize = 512;
		bufferLength = analyser.fftSize;
		dataArray = new Uint8Array(bufferLength);
		canvas_w = $('#osc_scope').width();
		canvas_h = $('#osc_scope').height();
		canvasCtx.clearRect(0, 0, canvas_w, canvas_h);
		master_gain.connect(analyser);
		drawOscScope();
	}

	// スケジュール管理(とても小さい音量でなっているのをオフにする)
	setInterval(function() {
		for (var i = 0; i < max_sound; i++) {
			if (manager[i]['using'] == false && 0 < gain_node[i].gain.value && gain_node[i].gain.value <= 0.001) {
				gain_node[i].gain.cancelScheduledValues(audioCtx.currentTime);
				gain_node[i].gain.setValueAtTime(0, audioCtx.currentTime);
				$('#pt_' + i).css({backgroundColor:'#ffffff'});
			}
		}
	}, 100);
	
	// MIDI初期化
	initMIDI();
});

function createUI()
{
	// シンセのパネル
	var panel = $("#p1_tr").html();
	var panel_title = "<tr id='panel_title'>" + $('#panel_title').html() + "</tr>";
	var panel_common = $("#panel_common").html();
	$("#panel_common").html("");
	var panel_parent = panel_title + "<tr id='p1'>" + panel + "<td id='panel_common' rowspan='" + partnum +"'>" + panel_common + "</td></tr>";
	for (var i = 2; i <= partnum; i++) {
		panel_parent += "<tr id='p" + i + "'>" + panel.replace(/p1_/g, 'p' + i + '_') + "</tr>";
	}
	$("#p1_tr").parent().html(panel_parent);


    // 縦スライダ
    $('.slider').each(function() {
    	var id = $(this).attr('id');
    	var slider_settings = {
    		orientation: 'vertical',
      		range: "min",
    		min: 0,
    		max: 127,
      		value: 0,
      		slide: function( event, ui ) {
      			$('#' + id + '_ipt').val(ui.value);
      		}
    	};
    	for (var key in slider_settings) {
    		if ($(this).attr('data-' + key) != undefined) {
    			var val = $(this).attr('data-' + key);
    			if (val === 'true') {
    				slider_settings[key] = true;
    			} else if (val === 'false') {
    				slider_settings[key] = false;
    			} else if (parseInt(val) != NaN) {
    				slider_settings[key] = parseInt(val);
    			} else {
    				slider_settings[key] = val;
    			}
    		}
    	}
    	$(this).css({
    		height: 90,
    		marginRight : 'auto',
    		marginLeft : 'auto',
    		marginTop : 10,
    		marginBottom : 10,
    	}).slider(slider_settings);

    	// 縦スライダの下につけるinput用
    	var spinner_settings = new Object();
    	spinner_settings['max'] = slider_settings['max'];
    	spinner_settings['min'] = slider_settings['min'];
    	spinner_settings['step'] = slider_settings['step'];
    	spinner_settings['spin'] = function(event, ui) {

    		$('#' + id).slider('value', ui.value);
    	};
    	$('#' + id + '_ipt').attr('value', parseInt($(this).slider("option", "value")));

    	$('#' + id + '_ipt').spinner(spinner_settings).width(20);
    });

    // ノブ
    $('.knob').each(function() {
    	var id = $(this).attr('id');
    	var changefunc = function(value) {
    		if (id == 'volume') {
    			master_gain.gain.value = parseInt($('#volume').val()) / 127;
    		}
    	};
    	var knob_settings = {
    		width: 55,
    		min : 0,
    		max : 127,
    		angleOffset : -150,
    		angleArc : 300,
    		height : 55,
    		cursor : false,
    		displayPrevious : true,
    		release : changefunc,
    		change: changefunc,
    	};
    	for (var key in knob_settings) {
    		if ($(this).attr('data-' + key) != undefined) {
    			var val = $(this).attr('data-' + key);
    			if (val === 'true') {
    				knob_settings[key] = true;
    			} else if (val === 'false') {
    				knob_settings[key] = false;
    			} else if (parseInt(val) != NaN) {
    				knob_settings[key] = parseInt(val);
    			} else {
    				knob_settings[key] = val;
    			}
    		}
    		
    	}
    	if ($(this).attr('value') == '' || $(this).attr('value') == undefined) {
    		$(this).attr('value', 0);
    	}
    	$(this).knob(knob_settings);
    });

    $('reset').button().click(function(event) {
    	reset();
    });

    // 発生音のテーブル
    var playing_table = '<tr>';
    for (i = 0; i < max_sound; i++) {
    	playing_table += '<td id="pt_' + i + '"></td>';
    }
    playing_table += '</tr>';
    $('#playing_table').html(playing_table);
    $('#playing_table').width($('#panel_main').width());
}

function initMIDI()
{
	navigator.requestMIDIAccess().then((function(ma) {
		// MIDIデバイスが使用可能
		inputs = new Array();
		outputs = new Array();
		midiAccess = ma;
		midiin_names = "<b>MIDI IN: </b>";

		if (typeof midiAccess.inputs == 'function') {
			// For Old Chrome
			inputs = midiAccess.inputs();
		} else {
			// For New Chrome
			var it = midiAccess.inputs.values();
			for (var o = it.next(); !o.done; o = it.next()) {
				inputs.push(o.value);
			}
		}

		if (inputs.length == 0) {
			alert("MIDI入力デバイスが見つかりませんでした。MIDI入力デバイスを接続後、Chromeを再起動してください。");
			midiin_names = "<b>NO MIDI INPUT DEVICES</b>"
		} else {
			for (var i = 0; i < inputs.length; i++) {
				inputs[i].onmidimessage = onMIDIMessage;
				midiin_names += inputs[i].name;
				if (i != inputs.length - 1) {
					midiin_names += ' / ';
				}
			}
		}
		$("#midi_ins").html(midiin_names);
	}), (function() {
		alert( "MIDIが使えません。" );
	}));
}

function onMIDIMessage(event)
{
	var e_data = event.data;
	var ch = (0x0f & e_data[0]);
	var notenum = e_data[1];
	var vel = e_data[2];

	if ((e_data[0] & 0xf0) == 0x90 && vel != 0) {
		// Note On
		if ($('#polymono').val() == 'mono') reset();
		play(notenum, vel);
	} else if ((e_data[0] & 0xf0) == 0x80 || ((e_data[0] & 0xf0) == 0x90 && vel == 0)) {
		// Note Off
		release(notenum);
	} else if ((e_data[0] & 0xf0) == 0xe0) {
		// pitch bend
		pitchbend = ((e_data[2] << 7) | e_data[1]) - 8192;
		if (pitchbend > 0) {
			pitchbend /= 8191;
			pitchbend *= parseInt($('#bend_up').val());
		} else if (pitchbend < 0) {
			pitchbend /= -8192
			pitchbend *= parseInt($('#bend_down').val());
		}
		reschedulePitchAll();
	} else if ((e_data[0] & 0xf0) == 0xb0 && e_data[1] == 0x01) {
		modlever = e_data[2] / 127;
		for (var i = 0; i < max_sound; i++) {
			if (gain_node[i].gain.value > 0) {
				var p = manager[i]['partial'];
				var lfo_rate = (parseInt($('#p' + p + '_lfo_rate').val()) / 127) * 10;
				if (lfo_rate == 0) {
					lfo_pitch_gain_node[i].gain.value = 0;
					lfo_amp_gain_node[i].gain.value = 0;
					lfo_filter_gain_node[i].gain.value = 0;
				} else {
					lfo_pitch_gain_node[i].gain.value = parseInt($('#p' + p + '_lfo_ptc_ipt').val()) / 63 * 50;
					lfo_amp_gain_node[i].gain.value = parseInt($('#p' + p + '_lfo_amp_ipt').val()) / 63;
					lfo_filter_gain_node[i].gain.value = parseInt($('#p' + p + '_lfo_flt_ipt').val()) / 63 * 5000;
					lfo_pitch_gain_node[i].gain.value += parseInt($('#p' + p + '_mlfo_ptc_ipt').val()) / 63 * 50 * modlever;
					lfo_amp_gain_node[i].gain.value += parseInt($('#p' + p + '_mlfo_amp_ipt').val()) / 63 * modlever;
					lfo_filter_gain_node[i].gain.value += parseInt($('#p' + p + '_mlfo_flt_ipt').val()) / 63 * 5000 * modlever;
				}
			}
		}
	}
}

function drawOscScope()
{
	drawVisual = requestAnimationFrame(drawOscScope);
	analyser.getByteTimeDomainData(dataArray);
	canvasCtx.fillStyle = '#ffffff';
	canvasCtx.fillRect(0, 0, canvas_w, canvas_h);
	canvasCtx.lineWidth = 3;
	canvasCtx.strokeStyle = '#3399ff';
	canvasCtx.beginPath();
	var sliceWidth = canvas_w * 1.0 / bufferLength;
    var x = 0;
    for(var i = 0; i < bufferLength; i++) {
    	var v = dataArray[i] / 128.0;
    	var y = v * canvas_h/2;
		if(i === 0) {
			canvasCtx.moveTo(x, y);
		} else {
			canvasCtx.lineTo(x, y);
		}
		x += sliceWidth;
    }
    canvasCtx.lineTo(canvasCtx.width, canvasCtx.height/2);
    canvasCtx.stroke();
}

function allocNode()
{
	var start = next_node;
	for (i = 0; i < max_sound; i++) {
		var j = (i + start) % max_sound;
		if (gain_node[j].gain.value == 0 && manager[j]['using'] == false) {
			next_node = j + 1;
			return j;
		}
	}
	
	return 0;
}

function reschedulePitchAll()
{
	// ピッチベンドがかかった時に今再生されているすべての音のピッチのスケジュールを変更する
	for (var i = 0; i < max_sound; i++) {
		if (gain_node[i].gain.value != 0) {
			var t0 = manager[i]['start_time'];
			var first_note = manager[i]['first_note'];
			var first_time = manager[i]['first_time'];
			var second_note = manager[i]['second_note'];
			var second_time = manager[i]['second_time'];
			var end_time = manager[i]['end_time'];
			var start_note = manager[i]['start_note'];
			var target_note = manager[i]['target_note'];
			if (manager[i]['p_dpt'] == 0 && manager[i]['portament_time'] == 0) {
				osc_node[i].frequency.setValueAtTime(notenum2Freq(target_note + pitchbend), audioCtx.currentTime);
			} else {
				osc_node[i].frequency.cancelScheduledValues(audioCtx.currentTime);
				osc_node[i].frequency.exponentialRampToValueAtTime(notenum2Freq(target_note + pitchbend), t0 + end_time);
				osc_node[i].frequency.exponentialRampToValueAtTime(notenum2Freq(second_note + pitchbend), t0 + second_time + 0.0001);
				osc_node[i].frequency.exponentialRampToValueAtTime(notenum2Freq(first_note + pitchbend), t0 + first_time);
			}
		}
	}
}

function play(notenum, vel)
{
	for (var p = 1; p <= partnum; p++) {
		if ($("#p" + p + "_onoff").prop('checked')) {
			// 使用するオシレータの確保
			i = allocNode();

			// 再生
			manager[i]['using'] = true;
			manager[i]['notenum'] = notenum;

			var t0 = audioCtx.currentTime;

			// OSCの設定
			var oct = parseInt($('#p' + p + '_p_oct').val()) * 12;
			var pitch = parseInt($('#p' + p + '_p_ptc').val());
			var dtn = parseInt($('#p' + p + '_p_dtn').val()) / 100;
			osc_node[i].type = $('#p' + p + '_osc').val();

			// PITCHの設定
			var porta_change_rate;
			var portament_time = parseInt($('#portament').val()) / 127 * 30;
			var p_a = parseInt($('#p' + p + '_p_a_ipt').val()) / 127 * 30;
			var p_d = parseInt($('#p' + p + '_p_d_ipt').val()) / 127 * 30;
			var p_dpt = parseInt($('#p' + p + '_p_dpt_ipt').val()) / 63 * 24;
			var target_note = notenum + pitch + oct + dtn;
			var first_note, second_note, first_time, second_time, end_time;
			if (portament_time == 0) {
				// ポルタメントなし
				start_note = target_note;
				first_note = target_note + p_dpt;
				second_note = target_note;
				first_time = p_a;
				second_time = p_a + p_d;
				end_time = p_a + p_d + 0.0001;
			} else {
				porta_change_rate = (target_note - start_note) / portament_time;
				if (portament_time >= p_a + p_d) {
					first_note = start_note + p_dpt + porta_change_rate * p_a;
					second_note = start_note + porta_change_rate * (p_a + p_d);
					first_time = p_a;
					second_time = p_a + p_d;
					end_time = portament_time;
				} else if (p_a <= portament_time && portament_time < p_a + p_d) {
					first_note = start_note + p_dpt + porta_change_rate * p_a;
					second_note = target_note + (-1 * p_dpt / p_d) * (portament_time - p_a) + p_dpt;
					first_time = p_a;
					second_time = portament_time;
					end_time = p_a + p_d;
				} else if (portament_time < p_a) {
					first_note = start_note + (p_dpt / p_a) * portament_time;
					second_note = target_note + p_dpt;
					first_time = portament_time;
					second_time = p_a;
					end_time = p_a + p_d + 0.0002;
				}
			}
			osc_node[i].frequency.cancelScheduledValues(t0);
			osc_node[i].frequency.setValueAtTime(notenum2Freq(start_note + pitchbend), t0);
			osc_node[i].frequency.exponentialRampToValueAtTime(notenum2Freq(target_note + pitchbend), t0 + end_time);
			osc_node[i].frequency.exponentialRampToValueAtTime(notenum2Freq(second_note + pitchbend), t0 + second_time + 0.0001);
			osc_node[i].frequency.exponentialRampToValueAtTime(notenum2Freq(first_note + pitchbend), t0 + first_time);

			// PANの設定
			var pan, _pan = parseInt($('#p' + p + '_a_pan').val());
			if (_pan > 0) {
				pan = _pan / 63;
			} else if (_pan == 0) {
				pan = 0;
			} else {
				pan = _pan / 64;
			}
			pan_node[i].setPosition(pan,0,0);

			// Filterの設定
			var cutoff = parseInt($('#p' + p + '_f_c').val()) / 127 * 22000;
			var resonance = parseInt($('#p' + p + '_f_reso').val()) / 127;
			var f_a = parseInt($('#p' + p + '_f_a_ipt').val()) / 127 * 5;
			var f_d = parseInt($('#p' + p + '_f_d_ipt').val()) / 127 * 5;
			var f_dpt = parseInt($('#p' + p + '_f_dpt_ipt').val()) / 63 * 22000;
			var f_s = parseInt($('#p' + p + '_f_s_ipt').val()) / 127 * f_dpt;
			filter_node[i].type = $('#p' + p + '_f_type').val();
			filter_node[i].Q.value = resonance * 40;
			filter_node[i].frequency.setValueAtTime(cutoff, t0);
			filter_node[i].frequency.linearRampToValueAtTime(cutoff + f_dpt, t0 + f_a); // Attack
			filter_node[i].frequency.setTargetAtTime(cutoff + f_s, t0 + f_a, f_d);

			// AMPの設定
			var vol = (parseInt($('#p' + p + '_a_vol').val()) / 127) * 0.5;
			var a_a = (parseInt($('#p' + p + '_a_a_ipt').val()) / 127) * 5;
			var a_d = (parseInt($('#p' + p + '_a_d_ipt').val()) / 127) * 5;
			var a_s = (parseInt($('#p' + p + '_a_s_ipt').val()) / 127) * vol * 0.5;
			gain_node[i].gain.setValueAtTime(0, t0);
			gain_node[i].gain.linearRampToValueAtTime(vol * 0.5, t0 + a_a); // Attack
			gain_node[i].gain.setTargetAtTime(a_s, t0 + a_a, a_d);

			// LFOの設定
			var lfo_rate = (parseInt($('#p' + p + '_lfo_rate').val()) / 127) * 10;
			lfo_osc_node[i].frequency.value = lfo_rate;
			lfo_osc_node[i].type = $('#p' + p + '_lfo_type').val();
			if (lfo_rate == 0) {
				lfo_pitch_gain_node[i].gain.value = 0;
				lfo_amp_gain_node[i].gain.value = 0;
				lfo_filter_gain_node[i].gain.value = 0;
			} else {
				lfo_pitch_gain_node[i].gain.value = parseInt($('#p' + p + '_lfo_ptc_ipt').val()) / 63 * 50;
				lfo_amp_gain_node[i].gain.value = parseInt($('#p' + p + '_lfo_amp_ipt').val()) / 63;
				lfo_filter_gain_node[i].gain.value = parseInt($('#p' + p + '_lfo_flt_ipt').val()) / 63 * 5000;
				lfo_pitch_gain_node[i].gain.value += parseInt($('#p' + p + '_mlfo_ptc_ipt').val()) / 63 * 50 * modlever;
				lfo_amp_gain_node[i].gain.value += parseInt($('#p' + p + '_mlfo_amp_ipt').val()) / 63 * modlever;
				lfo_filter_gain_node[i].gain.value += parseInt($('#p' + p + '_mlfo_flt_ipt').val()) / 63 * 5000 * modlever;
			}

			manager[i]['start_time'] = t0;
			manager[i]['partial'] = p;
			manager[i]['first_note'] = first_note;
			manager[i]['first_time'] = first_time;
			manager[i]['second_note'] = second_note;
			manager[i]['second_time'] = second_time;
			manager[i]['end_time'] = end_time;
			manager[i]['start_note'] = start_note;
			manager[i]['target_note'] = target_note;
			manager[i]['portament_time'] = portament_time;
			manager[i]['p_dpt'] = p_dpt;

			$('#pt_' + i).css({backgroundColor:'#3399ff'});
		}
	}

	start_note = target_note;
}

function release(notenum)
{
	// 今鳴らしているオシレーターを探す
	for (var i = 0; i < max_sound; i++) {
		if (manager[i]['notenum'] == notenum) {
			var c_time = audioCtx.currentTime;
			var a_r = (parseInt($('#p' +  manager[i]['partial'] + '_a_r_ipt').val()) / 127) * 5;
			var f_r = (parseInt($('#p' +  manager[i]['partial'] + '_f_r_ipt').val()) / 127) * 5;
			var cutoff = parseInt($('#p' + manager[i]['partial'] + '_f_c').val()) / 127 * 22000;
			filter_node[i].frequency.cancelScheduledValues(c_time);
			filter_node[i].frequency.setTargetAtTime(cutoff, c_time, f_r);
			gain_node[i].gain.cancelScheduledValues(c_time);
			gain_node[i].gain.setTargetAtTime(0.0001, c_time, a_r);
			manager[i]['using'] = false;
		}
	}
}

function notenum2Freq(note)
{
	return Math.pow(2,(note - 69) / 12) * 440;
}

function reset()
{
	for (var i = 0; i < max_sound; i++) {
		var t0 = audioCtx.currentTime;
		gain_node[i].gain.cancelScheduledValues(t0);
		gain_node[i].gain.setValueAtTime(0, t0);
		$('#pt_' + i).css({backgroundColor:'#ffffff'});
	}
}
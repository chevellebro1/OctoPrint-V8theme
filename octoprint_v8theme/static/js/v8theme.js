$(function() {
  function V8ThemeViewModel(parameters) {
    var self = this;
    self.temperature = parameters[0];
    self.terminal = parameters[1];
    self.files = parameters[2];
    self.customControls = parameters[3];

    /* Modified from OctoPrint
     * Reason: Edit how line numbers are displayed and created a buffer when
     * autoscroll is disabled.
     */
    self.terminal.lineCount = ko.computed(function() {
      var total = self.terminal.log().length;
      var displayed = _.filter(self.terminal.displayedLines(), function(entry) {
        return entry.type == "line"
      }).length;
      var filtered = total - displayed;

      if (total == displayed) {
        return _.sprintf(gettext("%(displayed)d"), {
          displayed: displayed
        });
      } else {
        return _.sprintf(gettext("%(displayed)d/%(total)d"), {
          displayed: displayed,
          total: total
        });
      }
    });
    self.terminal._processCurrentLogData = function(data) {
      self.terminal.log(self.terminal.log().concat(_.map(data, function(line) { return self.terminal._toInternalFormat(line) })));
      if (self.terminal.autoscrollEnabled()) {
        self.terminal.log(self.terminal.log.slice(-self.terminal.buffer()));
      } else {
        self.terminal.log(self.terminal.log.slice(-1000));
      }
    };

    /* Modified from OctoPrint
     * Reason: Edit color options, as well as number of ticks, and min/max values
     */
    var flotColors = ["#fbc08d", "#fde0c8", "#ffb6a6", "#ffdbd4"];
    self.temperature.plotOptions = {
      grid: {
        show: true,
        aboveData: true,
        color: "#3f3f3f",
        labelMargin: 5,
        axisMargin: 0,
        borderWidth: 0,
        borderColor: null,
        minBorderMargin: 5,
        clickable: true,
        hoverable: true,
        autoHighlight: false,
        backgroundColor: "#fcfcfc"
      },
      series: {
        lines: {
          show: true,
          fill: false,
          lineWidth: 2,
          steps: false
        },
        points: {
          show: false
        }
      },
      yaxis: {
        min: 0,
        max: 310,
        ticks: 10
      },
      xaxis: {
        mode: "time",
        minTickSize: [2, "minute"],
        tickFormatter: function(val, axis) {
          if (val == undefined || val == 0)
            return "";
          var timestampUtc = Date.now();
          var diff = timestampUtc - val;
          var diffInMins = Math.round(diff / (60 * 1000));
          if (diffInMins == 0)
            return gettext("just now");
          else
            return "- " + diffInMins + " " + gettext("min");
        }
      },
      colors: flotColors,
      shadowSize: 1,
      tooltip: true,
      tooltipOpts: {
        content: "%s : %y.0",
        shifts: {
          x: -30,
          y: -50
        },
        defaultTheme: false
      }
    };

    self.hideToolTip = function() {
      $("#tooltip_bar, #tooltip").css("display", "none");
      if (typeof self.temperature.plot !== "undefined") self.temperature.plot.unhighlight();
    }

    self.parseCustomControls = function() {
      $(".parsed-control").each(function() {
        $(this).remove();
      });
      $("#control .custom_section").each(function() {
        var accordionName = $(this).find('h1 span').text();
        accordionName_nospace = accordionName.replace(/\s+/g, '');
        $("#terminal_wrapper").after("<div id='" + accordionName_nospace + "_wrapper' class='accordion-group parsed-control'><div class='accordion-heading'><a class='accordion-toggle custom-control-toggle' data-toggle='collapse' data-target='#" + accordionName_nospace + "_main'><i class='icon-info-sign'></i> " + accordionName + " </a></div><div id='" + accordionName_nospace + "_main' class='accordion-body collapse in '><div class='accordion-inner'></div></div>");
        var elementHorizontal = $(this).find('.custom_section_horizontal'), elementHorizontalGrid = $(this).find('.custom_section_horizontal_grid'), elementVertical = $(this).find('.custom_section_vertical');
        if (elementHorizontal.length) {
          if (elementHorizontal.hasClass('hide')) {
            $("#" + accordionName_nospace + "_main").removeClass('in');
          }
          elementHorizontal.appendTo("#" + accordionName_nospace + "_main .accordion-inner");
        } else if (elementVertical.length) {
          if (elementVertical.hasClass('hide')) {
            $("#" + accordionName_nospace + "_main").removeClass('in');
          }
          elementVertical.appendTo("#" + accordionName_nospace + "_main .accordion-inner");
        } else if (elementHorizontalGrid.length) {
          if (elementHorizontalGrid.hasClass('hide')) {
            $("#" + accordionName_nospace + "_main").removeClass('in');
          }
          elementHorizontalGrid.appendTo("#" + accordionName_nospace + "_main .accordion-inner");
        }
        $(this).remove();
      });
    };

    /* Modified from OctoPrint
     * Reason: Remove temperature from label as well as renaming tool "T" to "Hotend"
     * and to apply our own colors
     */
    self.temperature.updatePlot = function() {
      var graph = $("#temperature-graph");
      if (graph.length) {
        var data = [];
        var heaterOptions = self.temperature.heaterOptions();
        if (!heaterOptions) return;

        _.each(_.keys(heaterOptions), function(type) {
          if (type == "bed" && !self.temperature.hasBed()) {
            return;
          }

          var actuals = [];
          var targets = [];

          if (self.temperature.temperatures[type]) {
            actuals = self.temperature.temperatures[type].actual;
            targets = self.temperature.temperatures[type].target;
          }

          var actualTemp = actuals && actuals.length ? formatTemperature(actuals[actuals.length - 1][1]) : "-";
          var targetTemp = targets && targets.length ? formatTemperature(targets[targets.length - 1][1]) : "-";

          if (heaterOptions[type].name == "T") {
            heaterOptions[type].name = "Hotend";
          } else if (heaterOptions[type].name == "Bed") {
            heaterOptions[type].name = "Build Plate";
          }

          /* Below, we edit the label by not including actualTemp or targetTemp */
          data.push({
            label: gettext("Actual") + " " + heaterOptions[type].name,
            data: actuals,
            lines: {
              fillColor: "#f3faff"
            }
          });
          data.push({
            label: gettext("Target") + " " + heaterOptions[type].name,
            data: targets,
            lines: {
              fillColor: "#fff8f7"
            }
          });
        });

        /* Hide tooltip and overlay bar every time we update the plot */
        self.temperature.plot = $.plot(graph, data, self.temperature.plotOptions);
        self.hideToolTip();
      }
    };

    self.onAllBound = function() {
      // Merge Temperature and Control tabs
      $("#temp_link").remove();
      $("#control_link").addClass("active");
      $("#control").prepend($("#temp").contents());
      $("#control").addClass("active");
      $("#temperature-graph").closest(".row").removeAttr("style");
      $("#temperature-graph").closest(".row").attr("class", "row-fluid");

      $("#settings_dialog_label").text("Settings");
      document.title = "Voxel8 DevKit";

      // Merge Control and Terminal tabs
      $("#navbar .brand").html("<img src='/plugin/v8theme/static/logo.png' />");

      $("#term_link").remove();
      $("#gcode_link").remove();
      $("#tabs").remove();
      $("#term").closest(".tab-content").addClass("main-content-wrapper");
      $("#control").prepend($("#term").contents());
      $(".octoprint-container .tab-content").before("<div id='temperature_monitor'></div><div id='temperature_wrapper' class='accordion-group'><div class='accordion-heading'><a class='accordion-toggle' data-toggle='collapse' data-target='#temperature_main'><i class='icon-info-sign'></i> Temperature </a><div class='heading_buttons'><button class='btn btn-mini btn-default btn-sm text-light7 temperature-height'>Expand</button></div></div><div id='temperature_main' class='accordion-body collapse in '><div class='accordion-inner'></div></div><div class='panel-footer pn'><div class='row-fluid table-layout'><div class='span4 panel-sidemenu border-right'> <h4 class='mb25 pl25'>Tool Temperature</h4> <div class='media active' data-toggle='tab' data-target='#hotend_temp'><span class='pull-left span6 hotend_temp'></span><div class='media-body span6'><div class='bulletColor' style='background-color: "+ flotColors[0] +";'></div><h5 class='media-heading p4'>Hotend<br></h5> </div> </div> <div class='media' data-toggle='tab' data-target='#bed_temp'><span class='pull-left span6 bed_temp'></span><div class='media-body span6'><div class='bulletColor' style='background-color: "+ flotColors[2] +";'></div><h5 class='media-heading p4'>Build Plate<br></h5> </div> </div> </div><div class='span8 va-m p15 pt20 temp_wrapper'><div class='tab-content'><div id='hotend_temp' class='tab-pane active'><h4 class='mb25'>Hotend Control</h4><div class='row-fluid'><div class='span6 pl15 pr15'><h6>Manual Control</h6><div class='row-fluid'><div class='span3'><label for='spinner' class='control-label'>Target</label></div><div class='span9'><div class='input-group hotend_target'></div></div></div><div class='row-fluid'><div class='span3'><label for='spinner' class='control-label'>Offset</label></div><div class='span9'><div class='input-group hotend_offset'></div></div></div></div><div class='span6 pl15'><h6>Temperature Presets</h6><div class='btn-spread'></div></div></div></div><div id='bed_temp' class='tab-pane'><h4 class='mb25'>Build Plate Control</h4><div class='row-fluid'><div class='span6 pl15 pr15'><h6>Manual Control</h6><div class='row-fluid'><div class='span3'><label for='spinner' class='control-label'>Target</label></div><div class='span9'><div class='input-group bed_target'></div></div></div><div class='row-fluid'><div class='span3'><label for='spinner' class='control-label'>Offset</label></div><div class='span9'><div class='input-group bed_offset'></div></div></div></div><div class='span6 pl15'><h6>Temperature Presets</h6><div class='btn-spread'></div></div></div></div></div></div></div></div></div>");
      $("#temperature_wrapper").after("<div id='control_wrapper' class='accordion-group'><div class='accordion-heading'><a class='accordion-toggle' data-toggle='collapse' data-target='#control_main'><i class='icon-info-sign'></i> Control </a></div><div id='control_main' class='accordion-body collapse in '><div class='accordion-inner'></div></div>");
      $("#control_wrapper").after("<div id='terminal_wrapper' class='accordion-group'><div class='accordion-heading'><a class='accordion-toggle' data-toggle='collapse' data-target='#terminal_main'><i class='icon-info-sign'></i> Commands <div class='terminal_input'></div></a></div><div id='terminal_main' class='accordion-body collapse'><div class='accordion-inner'></div></div>");

      $("#temperature-graph").parent().next(".row-fluid").prependTo("#temperature_main .accordion-inner");
      $("#temperature-graph").prependTo("#temperature_main .accordion-inner");
      $("#temperature-graph").wrap("<div class='temp-graph-wrapper'></div>");
      $("#temperature_main table-bordered").remove();

      $("#control .terminal").next(".row-fluid").next("div").prependTo("#terminal_main .accordion-inner");
      $("#control .terminal").next(".row-fluid").prependTo("#terminal_main .accordion-inner");
      $("#control .terminal").prependTo("#terminal_main .accordion-inner");

      $('link[rel="shortcut icon"]').attr('href', '/plugin/v8theme/static/favicon.ico');
      $("#terminal-output").addClass("well");

      $("#terminal_main").after("<div class='panel-footer'><div class='row-fluid'><div class='span8 terminal-textbox'></div><div class='span4 terminal-submit'></div></div></div>");
      $("#terminal_wrapper .accordion-heading").append("<div class='heading_buttons'><div class='label line-container'></div><button type='button' class='btn btn-default btn-gradient btn-sm dropdown-toggle' data-toggle='dropdown'><span class='caret'></span></button><ul class='dropdown-menu pull-right terminal-options' role='menu'></ul></div>");
      $(".terminal span[data-bind*='lineCount']").appendTo("#terminal_wrapper .heading_buttons .label");
      $(".terminal .pull-right a").each(function() {
        $("ul.terminal-options").append(
          $('<li>').append(
            $(this)
          ))
      });
      $(".line-container").after($(".terminal button[data-bind*='toggleAutoscroll']").addClass("btn-default btn-sm text-light7 mr5"));
      $(".terminal-options").append("<li class='divider'></li>");
      $("#termin-filterpanel label.checkbox").each(function() {
        var commandName = $(this).find("input").attr("value").match("Send: (.*)Recv")[1];
        commandName = commandName.replace(/\(|\)|\|/g, "");
        $(this).find("span").replaceWith("<span>Supress " + commandName + "</span>");
        $(this).css('margin-bottom', '0');
        $("ul.terminal-options").append(
          $('<li>').append(
            $('<a>').attr('href', '#').append(
              $(this)
            )))
      });
      $("#terminal-sendpanel .input-append input").addClass("form-control").attr("placeholder", "Enter a command...").appendTo(".terminal-textbox");
      $("#terminal-sendpanel .input-append button").addClass("btn-default btn-gradient btn-block").appendTo(".terminal-submit");
      $("#termin-filterpanel").parent().remove();
      $(".terminal .pull-left, .terminal .pull-right").remove();

      $(".temperature-height").click(function() {
        $(".temperature-height").toggleClass("active");
        $("#temperature-graph").animate({
          height: ($("#temperature-graph").height() == 250) ? 500 : 250
        }, {
          duration: 250,
          step: function() {
            self.temperature.updatePlot();
          }
        });
        $("#tooltip_bar").animate({
          height: ($("#temperature-graph").height() == 250) ? 485 : 235
        }, 250);
      });
      $("<div id='tooltip_bar'><div id='tooltip'><table><tbody></tbody></table></div></div>").appendTo("#temperature_main .accordion-inner");

      var legends = $("#temperature-graph .legendLabel");
      legends.each(function() {
        $(this).css('width', $(this).width());
      });

      // Legend/tooltip for Flot chart
      var updateLegendTimeout = null;
      var latestPosition = null;

      function updateLegend() {
        updateLegendTimeout = null;
        self.hideToolTip();
        var pos = latestPosition,
          axes = self.temperature.plot.getAxes();
        if (pos.x < axes.xaxis.min || pos.x > axes.xaxis.max || pos.y < axes.yaxis.min || pos.y > axes.yaxis.max) return;
        var dataset = self.temperature.plot.getData();
        if (dataset.length <= 0 || typeof dataset[0].data[1] === "undefined") return;
        var halfDist = (dataset[0].data[1][0] - dataset[0].data[0][0]) / 2;
        $("#tooltip tbody").empty();
        for (var i = 0; i < dataset.length; i++) {
          var series = dataset[i];
          for (j = 0; j < series.data.length; j++) {
            if (series.data[j][0] - halfDist > pos.x) {
              break;
            }
          }
          self.temperature.plot.highlight(i, j - 1);
          $("#tooltip_bar").css({
            "display": "block",
            "left": axes.xaxis.p2c(series.data[j - 1][0]) + 21
          });
          $("#tooltip").css({
            "display": "block",
            "left": "55px",
            "right": "auto",
            "top": Math.ceil((pos.pageY - $("#temperature-graph").offset().top - 40) / 50.0) * 50
          });
          legends.eq(i).text(series.label.replace(/=.*/, "= " + series.data[j - 1][1].toFixed(2)));
          $("#tooltip tbody").append(
            $('<tr>').append(
              $('<td><div class="bulletColor" style="background-color: ' + series.color + '"></div></td><td class="key">' + series.label + '</td><td class="value">' + series.data[j - 1][1] + '</td>')
            ))
          if ($("#temperature-graph").width() - ($("#tooltip").width() + $("#tooltip_bar").position().left + $("#tooltip").position().left) < 0) {
            $("#tooltip").css({"right": "55px", "left": "auto"});
          }
          if (($("#temperature-graph").offset().top + $("#temperature-graph").height()) < ($("#tooltip").offset().top + $("#tooltip").height())) {
            $("#tooltip").css("top", "-=75");
          }
        }
      }
      $("#temperature-graph").bind("plothover", function(event, pos, item) {
        latestPosition = pos;
        if (!updateLegendTimeout) {
          updateLegendTimeout = setTimeout(updateLegend, 50);
        }
      });
      $(window).resize(function() {
        self.temperature.updatePlot();
      });
      $("#temperature_main").mouseleave(function() {
        self.hideToolTip();
      });
      $("#navbar ul, #navbar li").mouseenter(function() {
        self.hideToolTip();
      });

      $(".nav-collapse").addClass("collapse");
      $(".btn-navbar").click(function() {
        $(".octoprint-container .span4").first().toggleClass("mt0");
      });

      $("#temperature_wrapper .media").click(function() {
        $("#temperature_wrapper .media").removeClass("active");
        $(this).addClass("active");
      });
      $('head').append("<meta name='viewport' content='width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no' />");

      var element, equipmentName, elementSidebar, elementActual, elementTarget, elementOffset;
      $("#temperature_wrapper .table-bordered tbody tr").each(function() {
        element = $(this);
        equipmentName = element.find("th").first().text();
        elementActual = element.find("td:eq(0)");
        elementTarget = element.find("td:eq(1)");
        elementOffset = element.find("td:eq(2)");
        if (equipmentName == "Hotend") {
          elementActual.appendTo(".hotend_temp");
          elementTarget.appendTo("#hotend_temp .hotend_target");
          elementOffset.appendTo("#hotend_temp .hotend_offset");
        } else if (equipmentName == "Bed") {
          elementActual.appendTo(".bed_temp");
          elementTarget.appendTo("#bed_temp .bed_target");
          elementOffset.appendTo("#bed_temp .bed_offset");
        }
      });

      var tempButton;
      $(".hotend_target .dropdown-menu li").each(function() {
        tempButton = $(this).find("a");
        if (tempButton.text().indexOf('(') !== -1) {
          tempLabel = tempButton.text().match(/\(([^)]+)\)/)[1];
          tempButton.text(tempButton.text().replace(tempLabel, "").replace(/ |\(|\)/g, ""));
        } else {
          tempLabel = "Off"
        }
        tempButton.text(tempButton.text().replace(/Set/g, ""));
        tempButton.wrapInner("<button class='btn' title='" + tempLabel + "'></button>").appendTo("#hotend_temp .btn-spread");
      });
      $(".bed_target .dropdown-menu li").each(function() {
        tempButton = $(this).find("a");
        if (tempButton.text().indexOf('(') !== -1) {
          tempLabel = tempButton.text().match(/\(([^)]+)\)/)[1];
          tempButton.text(tempButton.text().replace(tempLabel, "").replace(/ |\(|\)/g, ""));
        } else {
          tempLabel = "Off"
        }
        tempButton.text(tempButton.text().replace(/Set/g, ""));
        tempButton.wrapInner("<button class='btn' title='" + tempLabel + "'></button>").appendTo("#bed_temp .btn-spread");
      });
      $(".hotend_target button.dropdown-toggle, .hotend_target .dropdown-menu").remove();
      $(".bed_target button.dropdown-toggle, .bed_target .dropdown-menu").remove();
      $("#temperature_main table.table-bordered").remove();

      $(".btn-spread").tooltip({
        position: {
          my: "left top+10",
          at: "center-15 bottom",
          collision: "flipfit"
        }
      });

      $('.accordion-heading').has('.heading_buttons').click(_.throttle(function (e) {
        if ($(e.target).is('.heading_buttons') || $(e.target).parents('.heading_buttons').length > 0) { return }
        if ($(this).next('.accordion-body').hasClass('in')) {
          $(this).find('.heading_buttons').fadeOut('150');
        } else {
          $(this).find('.heading_buttons').fadeIn('150');
        }
      }, 375, {trailing: false}, {leading: false}));

    };

    self.onAfterTabChange = function(current, previous) {
      if (current != "#control") {
        return;
      }
      self.temperature.updatePlot();
    }

    self.onStartupComplete = function() {
      self.parseCustomControls();

      $("#control").appendTo("#control_main .accordion-inner");
      $('<div class="panel-footer pn bt0"><div class="row-fluid table-layout"><div class="span4 panel-sidemenu border-right control-panel-left"></div><div class="span8 p15 pt20 control-panel-right"></div></div></div>').prependTo("#control_main");
      $('#control .jog-panel').first().appendTo(".control-panel-left");
      $('#control .jog-panel').each(function() {
        $(this).appendTo(".control-panel-right");
      });
      $(".control-panel-left h1").each(function(i, em) {
        $(em).replaceWith('<h2>'+$(em).html()+'</h2>');
      });
      $(".control-panel-right h1").each(function(i, em) {
        $(em).replaceWith('<h4>'+$(em).html()+'</h4>');
      });
      $("#terminal_main small.pull-left span").css({
        "display": "block",
        "text-align": "right"
      }).appendTo("#terminal_main small.pull-right");
      $(".sd-trigger a:first").html('<i class="icon-file"></i>');
      $("#temp").remove();
      $("#term").remove();
      $("#webcam_container, #control_main div[data-bind*='keycontrolPossible']").remove();

      // Manage extra contents of .tab-content 
      $("#gcode").remove();
      var tabContentHTML = $(".main-content-wrapper").html().replace(/<!-- ko allowBindings: false -->|<!-- \/ko -->|<!-- ko allowBindings: true -->/g, "");
      if (tabContentHTML.trim().length) {
        $(".main-content-wrapper").after("<div id='Additional_wrapper' class='accordion-group'> <div class='accordion-heading'> <a class='accordion-toggle' data-toggle='collapse' data-target='#Additional_main'><i class='icon-info-sign'></i> Additional Controls </a> </div> <div id='Additional_main' class='accordion-body collapse in'> <div class='accordion-inner'> </div></div></div></div>");
        $(".main-content-wrapper").appendTo("#Additional_main .accordion-inner");
      } else {
        $(".main-content-wrapper").remove();
      }
      $('.custom-control-toggle').click(function() {
        var toggleButton = $(this).closest('.accordion-group').find('.accordion-inner').find('.custom_section_horizontal, .custom_section_horizontal_grid, .custom_section_vertical');
        if (toggleButton.hasClass('hide')) {
          toggleButton.removeClass('hide');
        }
      });
      if (typeof localStorage["voxel8.gcodeFiles.currentSorting"] === "undefined") {
        self.currentSorting = "upload";
        localStorage["voxel8.gcodeFiles.currentSorting"] = self.currentSorting;
        self.files.listHelper.changeSorting(self.currentSorting);
      }
    };

    self.oldControl = self.customControls.rerenderControls;
    self.customControls.rerenderControls = function () {
      self.oldControl();
      self.parseCustomControls();
    }

    self.onEventPrintDone = function(payload) {
      if (typeof Notification === 'undefined') {
        console.log('Desktop notifications not available in your browser. Try Chromium.'); 
        return;
      }
      if (Notification.permission !== "granted")
        Notification.requestPermission();
      else {
        var timeInSecs = payload.time;
        var hours = Math.floor(timeInSecs / 3600);
        timeInSecs = timeInSecs % 3600;
        var minutes = Math.floor(timeInSecs / 60);
        timeInSecs = timeInSecs % 60;
        var seconds = timeInSecs;
        var notification = new Notification(payload.filename + ' - Print Complete', {
          icon: '/plugin/v8theme/static/square_logo.png',
          body: "Your print is complete after " + hours + " hour(s), " + minutes + " minute(s), and " + seconds + " second(s).",
        });
        notification.onclick = function () {
          window.focus();  
          notification.close();
        };
      }
    }
  }

  OCTOPRINT_VIEWMODELS.push([
    V8ThemeViewModel, ["temperatureViewModel", "terminalViewModel", "gcodeFilesViewModel", "customControlViewModel"],
    []
  ]);
});

document.addEventListener('DOMContentLoaded', function () {
  if (typeof Notification === 'undefined')
    return;
  if (Notification.permission !== "granted")
    Notification.requestPermission();
});

function checkWidth() {
  if ($(window).width() > 767) {
    $(".octoprint-container .span4").first().removeClass("mt0");
  } else if ($(window).width() <= 767 && $(".nav-collapse").hasClass("in")) {
    $(".octoprint-container .span4").first().addClass("mt0");
  }
}

$(window).resize(function() {
  checkWidth();
});
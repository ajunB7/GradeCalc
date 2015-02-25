function gradecalc(userid, htmlId) { 
 "use strict";
 var api2 = "api.uwaterloo.ca/v2/";
 var key = "HIDDEN";
 var appkey = "HIDDEN";
 var wsURL = "https://" + server;
 

 var templates = {};

 var model = {
  courses: {},
  views: [],
  userData: {},

    // Initialize this object
    init: function () {
      var that = this;
      var currentTerm;

      // // https://api.uwaterloo.ca/v2/terms/list.json?key=Hidden
      $.getJSON(getTerms(),
       function (d) {
        currentTerm = d.data.current_term;

	        	      // Initialize courses
                  $.getJSON(getCourseDetails(),
                    function (d) {
                      $.each(d.result.terms, function(key, value) {

                        if(value.term == currentTerm){
                         that.courses = value;
                       }
                     });

                      var firstTimeUser = false;

                      $.getJSON(wsURL + "/getUserData/gradecalc/"+userid+"?key="+appkey,
                       function (d) {
                        console. log(d);
                        if (d.meta.status === "404 Not Found") {
                          firstTimeUser =  true;
                          console.log("404");
                        }else if(typeof d.result.subjects === "undefined"){
                          firstTimeUser =  true;
                        }else {
                         model.userData = d.result;
                         that.userData = model.userData;
                         that.updateViews("subjects");
                       }

                       if(firstTimeUser){
                        model.initDataFirstTime();
                      }
                    }).fail(function(jqxhr, textStatus, error) {
                      model.initDataFirstTime();
                    });

				      	  // that.courses = d.result;
                }).fail(function( jqxhr, textStatus, error ) {
                 var err = textStatus + ", " + error;
                 console.log( "Request Failed: " + err );
               });
              }).fail(function( jqxhr, textStatus, error ) {
                var err = textStatus + ", " + error;
                console.log( "Request Failed: " + err );
              });
            },

            initDataFirstTime: function() {
              var that = this;
              that.userData = {};
              that.userData.subjects = [];
              $.each(that.courses.courses, function(key, value) {
                var subjectDict = {};
                subjectDict["subject"] = value.subjectCode + value.catalog;
                subjectDict["currGrade"] = "N/A";
                subjectDict["targGrade"] = "Not Set";
                subjectDict["reqGrade"] = "N/A";
                subjectDict["weightAchieved"] = 0;
                subjectDict["components"] = [];
                that.userData["subjects"].push(subjectDict);
              });
              model.storeData();
              model.userData = that.userData;
              that.userData = model.userData;
              that.updateViews("subjects");
            },

            calculateRequiredGrade: function (data) {      
              var tg = parseFloat(data.targGrade);
              var cg = parseFloat(data.currGrade);
              var wa = data.weightAchieved;
              var wl = 100 - wa;

              var rg = (tg - (cg * (wa / 100))) / (wl / 100);

              if (isNaN(rg)) {
                return "N/A";
              }

              return rg.toFixed(2);
            },
            calculateCurrentGrade: function (subject) {
              $.each(model.userData.subjects, function(key, value) {
                if(value.subject === subject){
                var wa = 0; //weight achieved
                var ma = 0; //marks achieved

                for (var i = 0; i < value.components.length; i++) {
                  var comp = value.components[i];

                  wa = wa + parseFloat(comp.weight);
                  ma = ma + (comp.percentage / 100) * comp.weight;
                }

                var cg = ((ma / wa) * 100);
                
                if (isNaN(cg)) {
                  value.currGrade = "N/A";
                }
                else {
                  value.currGrade = cg.toFixed(2);
                }
                
                value.weightAchieved = wa;
                value.reqGrade = model.calculateRequiredGrade(value);
              }
            });

            },
            addData: function(subjectNew, componentData) {
             $.each(model.userData.subjects, function(key, value) {
              if(value.subject === subjectNew){
               componentData.id = value.components.length + 1;
               componentData.percentage = ((parseFloat(componentData.mark) / parseFloat(componentData.total)) * 100).toFixed(2);
               console.log("percentage: " + componentData.percentage);
               value.components.push(componentData);
             }
           });

             model.calculateCurrentGrade(subjectNew);
             model.storeData();
           },
           editTargetGradeData: function(subjectName, targetGrade) {
            $.each(model.userData.subjects, function(key, value) {
              if(value.subject === subjectName){
                value.targGrade = targetGrade;
                value.reqGrade = model.calculateRequiredGrade(value);
              }
            });

            model.storeData();
          },
          editData: function(subjectName, id ,componentData) {
           $.each(model.userData.subjects, function(key, value) {
            if(value.subject === subjectName){
             var thatComponents = value.components;
             $.each(thatComponents, function(k, v) {
              if(v.id == id){
               componentData.id = v.id;
               componentData.percentage = ((parseFloat(componentData.mark) / parseFloat(componentData.total)) * 100).toFixed(2);
               model.userData.subjects[key].components[k] = componentData;
             }
           });
             value.components = thatComponents;
           }
         });
           model.calculateCurrentGrade(subjectName);
           model.storeData();
         },

         deleteData: function(subjectName, id){
           $.each(model.userData.subjects, function(key, value) {
            if(value.subject === subjectName){
             var thatComponents = value.components;
             $.each(thatComponents, function(k, v) {
              if(typeof v !== "undefined" && v.id == id){
                model.userData.subjects[key].weightAchieved = model.userData.subjects[key].weight - model.userData.subjects[key].components.weight;
                model.userData.subjects[key].components.splice(k, 1);
              }
            });
             value.components = thatComponents;
           }
         });
           model.calculateCurrentGrade(subjectName);
           model.storeData();
         },

         storeData: function() {
          console.log("gradecalc: storing " + JSON.stringify(this.userData));
          var that = this;
          $.ajax({
            type: "POST",
            url: wsURL + "/storeUserData/gradecalc/"+userid+"?key="+appkey,
            datatype: "json",
            contentType: "application/json; charset=utf-8",
            data: JSON.stringify(that.userData),
            success: function(data) {
          // Only get the data if we successfully stored it
          that.getData();
        },
        failure: function(msg) {
          $(htmlId).html("<h1>FAILED to store user data</h1><p>" + msg + "</p>");      
        }
      });
        },

        getData: function() {
          var that = this;
          $.getJSON(wsURL + "/getUserData/gradecalc/"+userid+"?key="+appkey,
            function (d) {
              if (d.meta.status === "200 OK") {
                that.userData = d.result;
                that.updateViews("");
              } else {
                console.log("Failed to get user data." + JSON.stringify(d.meta));
              }
            });  
        },

        clearData: function() {
          model.userData = {};
          model.storeData();
          console.log("Cleared Data");
        },

    /**
     * Add a new view to be notified when the model changes.
     */
     addView: function (view) {
      this.views.push(view);
      view("");
    },

    /**
     * Update all of the views that are observing us.
     */
     updateViews: function (msg) {
      var i = 0;
      for (i = 0; i < this.views.length; i++) {
        this.views[i](msg);
      }
    }
  };



  var subjectView = {
    updateView: function (msg) {
      if (msg === "subjects") {
        var t = Mustache.render(templates.subjects, model.userData);
        $("#gradecalc_courseList").html(t);

// Validation
$(".gradecalc_componentData input").bind('input propertychange', function() {
 var letterNumber = /^[A-Za-z0-9 _]*[A-Za-z0-9][A-Za-z0-9 _]*$/;
 var parentModal = $(this).parents('.gradecalc_modal_body');
 var errorAlert = $(parentModal).children("#gradecalc_error");
 var submitButton = $(parentModal).find('.gradecalc_component_submit');

 if($(this).attr("valid") === "letters_numbers"){
  if(!(($(this).val().match(letterNumber))) && $(this).val().length != 0 ) {
    $(errorAlert).removeClass('hidden');
    $(errorAlert).text("This field only accepts letters and numbers");
    $(submitButton).addClass('disabled');
  }else{
    $(errorAlert).addClass('hidden');
    $(submitButton).removeClass('disabled');

  }
}else if($(this).attr("valid") === "numbers"){
  if((isNaN(parseFloat($(this).val()))) && $(this).val().length != 0 ) {

    $(errorAlert).removeClass('hidden');
    $(errorAlert).text("This field only accepts numbers");
    $(submitButton).addClass('disabled');
  }else{
    $(errorAlert).addClass('hidden');
    $(submitButton).removeClass('disabled');

  }
}
});
    // Target Value
    $(".gradecalc_edit_target").on("click", function(){
      var targetModal = $(this).attr("data-target");
      var target = $(targetModal).find(".gradecalc_target_input");
      if ($(target).attr("value") == "Not Set"){
        $(target).removeAttr('value');
      }
    });

		// accordion chevrons and collapse
    $(".gradecalc_accordhead").on('click', function() {
     var icon = $(this).find(".glyphicon");
     if(icon.hasClass('glyphicon-chevron-right')){
      icon.removeClass('glyphicon-chevron-right');
      icon.addClass('glyphicon-chevron-down');
    }else{
      icon.addClass('glyphicon-chevron-right');
      icon.removeClass('glyphicon-chevron-down');
    }
  });

        // Form Submit
        // New Form
        $('.gradecalc_form').on('submit', function(e) {
         e.preventDefault();
         var subject = $(this).attr("subject");
         var id = $(this).attr('id');
         var data = $(this, "input").serializeArray();

         var emptyForm = false;
         $.each(data,function(key, value) {
          if(value.value.length == 0){
            emptyForm = true;
            return false;
          }
        });

         if(emptyForm){
          var parentModal = $(this).parents('.gradecalc_modal_body');
          var errorAlert = $(parentModal).children("#gradecalc_error");
          $(errorAlert).text("Please fill out all fields");
          $(errorAlert).removeClass('hidden');
        }else{

         handleFormSubmit(data, subject);
         model.updateViews('subjects');
         $('body').removeClass('modal-open');
         $('.modal-backdrop').remove();
         $('#gradecalc_formcalc_accordion #heading_' + subject).click();
       }
     });
    	// Edit Form
      $('.gradecalc_edit_form').on('submit', function(e) {
       e.preventDefault();
       var subject = $(this).attr("subject");
       var key = $(this).attr("key");
       var id = $(this).attr('id');
       var data = $(this, "input").serializeArray();

       var emptyForm = false;
       $.each(data,function(key, value) {
        if(value.value.length == 0){
          emptyForm = true;
          return false;
        }
      });

       if(emptyForm){
        var parentModal = $(this).parents('.gradecalc_modal_body');
        var errorAlert = $(parentModal).children("#gradecalc_error");
        $(errorAlert).text("Please fill out all fields");
        $(errorAlert).removeClass('hidden');
      }else{

       handleFormEditSubmit(data,key, subject);
       model.updateViews('subjects');
       $('body').removeClass('modal-open');
       $('.modal-backdrop').remove();
       $('#gradecalc_formcalc_accordion #heading_' + subject).click();
     }
   });
      $(".gradecalc_delete #delete").on('click', function(e){
        var key = $(this).attr("key");
        var subject = $(this).attr("subject");
        model.deleteData(subject, key);
        model.updateViews('subjects');
        $('body').removeClass('modal-open');
        $('.modal-backdrop').remove();
        $('#heading_' + subject).click();
      });

      //target grade edit form
      $('.gradecalc_edit_targetGrade_form').on('submit', function(e) {
        e.preventDefault();
        var subject = $(this).attr("subject");
        var data = $(this, "input").serializeArray();

        var tg = parseFloat(data[0].value);

        if (isNaN(tg) || tg < 0 || tg > 100) {
          $("#gradecalc_" + subject + "b43v3r").removeClass("hidden");
        }
        else {
          handleFormEditTargGradeSubmit(data, subject);
          model.updateViews('subjects');
          $("#gradecalc_" + subject + "b43v3r").addClass("hidden");
          $('body').removeClass('modal-open');
          $('.modal-backdrop').remove();
          $('#gradecalc_formcalc_accordion #heading_' + subject).click();
        }
      });
    }
  },

    // Initialize this object
    init: function () {
    }
  };

  function handleFormSubmit(data, subject){
   var componentData = {};
	// {title: A1 ... total: 100},
	for (var i = 0; i < data.length; i++) {
		componentData[data[i].name] = data[i].value;
	};

	model.addData(subject, componentData);
}

function handleFormEditTargGradeSubmit(data, subject){
 var targetGrade = parseFloat(data[0].value);

 model.editTargetGradeData(subject, targetGrade);
}

function handleFormEditSubmit(data,id,subject){
  var componentData = {};
  // {title: A1 ... total: 100},
  for (var i = 0; i < data.length; i++) {
    componentData[data[i].name] = data[i].value;
  };

  model.editData(subject,id, componentData);
}

function getTerms() {
  if (server === "localhost") {
    return "file:///Users/Ajun/Documents/3B/CS349/shared/a4/a4/fakes/api2.json";
  } else {
    return "https://" + api2 + "terms/list.json?key=" + key;
  }    
}
function getCourseDetails() {
  if (server === "localhost") {
    return "file:///Users/Ajun/Documents/3B/CS349/shared/a4/a4/fakes/api.json";
  } else {
    return "https://" + server + "/api/v1/student/stdCourseDetails/" + userid;
  }    
}

  // Initialization
  portal.loadTemplates("widgets/gradecalc/templates.txt",
    function (t) {
      templates = t;
      $(htmlId).html('<H1 id="gradecalc_title"><H4>Grade Calculator</H4></H1><DIV id="gradecalc_courseList"></DIV>');
      model.init();
      subjectView.init();

      model.addView(subjectView.updateView);
    });
}

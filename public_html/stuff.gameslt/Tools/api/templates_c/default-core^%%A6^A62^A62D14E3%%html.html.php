<?php /* Smarty version 2.6.26, created on 2014-11-04 22:05:38
         compiled from core/html/html.html */ ?>
<!doctype html>
<!-- paulirish.com/2008/conditional-stylesheets-vs-css-hacks-answer-neither/ -->
<!--[if lt IE 7]> <html class="no-js lt-ie9 lt-ie8 lt-ie7" lang="<?php echo $this->_tpl_vars['icms_langcode']; ?>
"> <![endif]-->
<!--[if IE 7]>    <html class="no-js lt-ie9 lt-ie8" lang="<?php echo $this->_tpl_vars['icms_langcode']; ?>
"> <![endif]-->
<!--[if IE 8]>    <html class="no-js lt-ie9" lang="<?php echo $this->_tpl_vars['icms_langcode']; ?>
"> <![endif]-->
<!--[if gt IE 8]><!--> <html class="no-js" lang="<?php echo $this->_tpl_vars['icms_langcode']; ?>
"> <!--<![endif]-->
<head>
  <?php $this->_smarty_include(array('smarty_include_tpl_file' => ($this->_tpl_vars['theme_name'])."/html/meta.html", 'smarty_include_vars' => array()));
 ?>
</head>
<body class="<?php if ($this->_tpl_vars['ishome']): ?>home <?php endif; ?><?php if ($this->_tpl_vars['bodyClasses']): ?><?php echo $this->_tpl_vars['bodyClasses']; ?>
<?php endif; ?><?php if ($this->_tpl_vars['inAdmin']): ?> admin<?php endif; ?>">
  <!-- Prompt IE 6 users to install Chrome Frame. Remove this if you support IE 6.
       chromium.org/developers/how-tos/chrome-frame-getting-started -->
  <!--[if lt IE 7]><p class=chromeframe>Your browser is <em>ancient!</em> <a href="http://browsehappy.com/">Upgrade to a different browser</a> or <a href="http://www.google.com/chromeframe/?redirect=true">install Google Chrome Frame</a> to experience this site.</p><![endif]-->  

  <!-- Facebook Javascript SDK -->
  <?php if ($this->_tpl_vars['use_facebook_sdk']): ?>
    <div id="fb-root"></div>
    <script>
      window.fbAsyncInit = function() {
        FB.init({
          appId      : '<?php echo $this->_tpl_vars['fb_app_id']; ?>
', // App I
          channelUrl : '<?php echo $this->_tpl_vars['icms_imageurl']; ?>
/extra/fbChannel.php', // Channel File
          status     : true, // check login status
          cookie     : true, // enable cookies to allow the server to access the session
          xfbml      : true  // parse XFBML
        });

        // Additional initialization code here
      };

      // Load the SDK Asynchronously
      (function(d){
         var js, id = 'facebook-jssdk', ref = d.getElementsByTagName('script')[0];
         if (d.getElementById(id)) {return;}
         js = d.createElement('script'); js.id = id; js.async = true;
         js.src = "//connect.facebook.net/en_US/all.js";
         ref.parentNode.insertBefore(js, ref);
       }(document));
    </script>    
  <?php endif; ?>
  
  <div id="fullWrapper" class="fullWrapper">
    <div id="fullWrapperInner" class="fullWrapperInner">
      <?php $this->_smarty_include(array('smarty_include_tpl_file' => ($this->_tpl_vars['theme_name'])."/html/header.html", 'smarty_include_vars' => array()));
 ?>
      <?php $this->_smarty_include(array('smarty_include_tpl_file' => ($this->_tpl_vars['theme_name'])."/html/page.html", 'smarty_include_vars' => array()));
 ?>
      <?php $this->_smarty_include(array('smarty_include_tpl_file' => ($this->_tpl_vars['theme_name'])."/html/footer.html", 'smarty_include_vars' => array()));
 ?>
    </div>
  </div>
  
  <?php if ($this->_tpl_vars['enable_twitter_intents']): ?>
    <script type="text/javascript" charset="utf-8">
      window.twttr = (function (d,s,id) {
        var t, js, fjs = d.getElementsByTagName(s)[0];
        if (d.getElementById(id)) return; js=d.createElement(s); js.id=id;
        js.src="//platform.twitter.com/widgets.js"; fjs.parentNode.insertBefore(js, fjs);
        return window.twttr || (t = { _e: [], ready: function(f){ t._e.push(f) } });
      }(document, "script", "twitter-wjs"));
    </script>
  <?php endif; ?>

  <?php echo $this->_tpl_vars['foot']; ?>

</body>
</html>
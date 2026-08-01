navigate = function navigateWithFullPageLoad(path, replace = false) {
  const target = internalPath(path, '/');
  if (replace) window.location.replace(target);
  else window.location.assign(target);
};

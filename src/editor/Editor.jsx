import React from 'preact/compat';
import { useState, useRef, useEffect } from 'preact/hooks';
import Environment from '../Environment';
import setPosition from './setPosition';
import i18n from '../i18n';

/** We need to compare bounds by value, not by object ref **/
const bounds = elem => {
  const { top, left, width, height } = elem.getBoundingClientRect();
  return `${top}, ${left}, ${width}, ${height}`;
}

/**
 * The popup editor component.
 * 
 * TODO instead of just updating the current annotation state,
 * we could create a stack of revisions, and allow going back
 * with CTRL+Z.
 */
const Editor = props => {
  
  // The current state of the edited annotation vs. original

  const [currentAnnotation, _setNotificationVisible] = useState();
  const _currentAnnotation = useRef(_currentAnnotation);
  const setCurrentAnnotation = (data) => {
    _currentAnnotation.current = data;
    _setNotificationVisible(data);
  };

  // const [ currentAnnotation, setCurrentAnnotation ] = useState();

  // Reference to the DOM element, so we can set position
  const element = useRef();

  const listenerFunction = (event) => {
    if(element.current !== null && !element.current.contains(event.target)){
      onOk();
      props.onCancel();
    }
  }


  const handleOutsideClick = () => {
    document.addEventListener("click", listenerFunction)
  }

  const removeListener = () =>{
    document.removeEventListener("click", listenerFunction)
  }


  // Re-render: set derived annotation state & position the editor
  useEffect(() => {
    // Shorthand: user wants a template applied and this is a selection
    const shouldApplyTemplate = props.applyTemplate && props.annotation?.isSelection;

    // Apply template if needed
    const annotation = shouldApplyTemplate ? 
      props.annotation.clone({ body: [ ...props.applyTemplate ]}) : 
      props.annotation;

    // The 'currentAnnotation' differs from props.annotation because
    // the user has been editing. Moving the selection bounds will 
    // trigger this effect, but we don't want to update the currentAnnotation
    // on move. Therefore, don't update if a) props.annotation equals
    // the currentAnnotation, or props.annotation and currentAnnotations are
    // a selection, just created by the user. 
    const preventUpdate = currentAnnotation?.isEqual(annotation) ||
      (currentAnnotation?.isSelection && annotation?.isSelection);
    
    if (!preventUpdate)
      setCurrentAnnotation(annotation);

    if (shouldApplyTemplate && props.applyImmediately)
      props.onAnnotationCreated(annotation.toAnnotation());
      handleOutsideClick()
    if (element.current) {
      // Note that ResizeObserver fires once when observation starts
      return initResizeObserver();
    }

    return () => {
      removeListener()
    }
  }, [ props.selectedElement, bounds(props.selectedElement) ]);

  

  const initResizeObserver = () => {
    if (window.ResizeObserver) {
      const resizeObserver = new ResizeObserver(() => {
        setPosition(props.wrapperEl, element.current, props.selectedElement);
      });

      resizeObserver.observe(props.wrapperEl);
      return () => resizeObserver.disconnect();
    } else {
      // Fire setPosition *only* for devices that don't support ResizeObserver
      setPosition(props.wrapperEl, element.current, props.selectedElement);
    }  
  }

  // Creator and created/modified timestamp metadata
  const creationMeta = body => {
    const meta = {};

    const { user } = Environment;

    // Metadata is only added when a user is set, otherwise
    // the Editor operates in 'anonymous mode'. Also,
    // no point in adding meta while we're in draft state
    if (!body.draft && user) {
      meta.creator = {};
      if (user.id) meta.creator.id = user.id;
      if (user.displayName) meta.creator.name = user.displayName;

      if (body.created)
        body.modified = Environment.getCurrentTimeAdjusted();
      else
        body.created = Environment.getCurrentTimeAdjusted();
    }

    return meta;
  }

  const onAppendBody = body => setCurrentAnnotation(
    currentAnnotation.clone({ 
      body: [ ...currentAnnotation.bodies, { ...body, ...creationMeta(body) } ] 
    })
  );

  const onUpdateBody = (previous, updated) => setCurrentAnnotation(
    currentAnnotation.clone({
      body: currentAnnotation.bodies.map(body => 
        body === previous ? { ...updated, ...creationMeta(updated) } : body)
    })
  );

  const onRemoveBody = body => setCurrentAnnotation(
    currentAnnotation.clone({
      body: currentAnnotation.bodies.filter(b => b !== body)
    })
  );

  const onOk = _ => {
    // Removes the 'draft' flag from all bodies
    if(props.readOnly){
      return;
    }
    const undraft = annotation => annotation.clone({
      body : annotation.bodies.map(({ draft, ...rest }) =>
        draft ? { ...rest, ...creationMeta(rest) } : rest )
    });

    // Current annotation is either a selection (if it was created from 
    // scratch just now) or an annotation (if it existed already and was
    // opened for editing)

    const currentAnnotation = _currentAnnotation.current

    if (currentAnnotation.bodies && currentAnnotation.bodies.length === 0) {
      if (currentAnnotation.isSelection)
        props.onCancel();
      else 
        props.onAnnotationDeleted(props.annotation);
    } else {
      if (currentAnnotation.isSelection)
        props.onAnnotationCreated(undraft(currentAnnotation).toAnnotation());
      else
        props.onAnnotationUpdated(undraft(currentAnnotation), props.annotation);
    }
  };


  const handleDelete = () => {
    if(props.readOnly){
      return;
    }
    props.onAnnotationDeleted(props.annotation);
    props.onCancel();
  }



  return (
    <div ref={element} id="mainEditor" className="r6o-editor">
      <div className="arrow" />
      <div className="inner">
        {React.Children.map(props.children, child =>
          React.cloneElement(child, { 
            ...child.props,
            annotation : currentAnnotation,
            readOnly : props.readOnly,
            onAppendBody : onAppendBody,
            onUpdateBody : onUpdateBody,
            onRemoveBody : onRemoveBody,
            onSaveAndClose : onOk              
          }))
        }
        <div className="dustbin" onClick={handleDelete}>
          <svg id="Layer_1" fill="currentColor" enable-background="new 0 0 512 512" height="512" viewBox="0 0 512 512" width="512" xmlns="http://www.w3.org/2000/svg">
                <g>
                <path d="m424 64h-88v-16c0-26.51-21.49-48-48-48h-64c-26.51 0-48 21.49-48 48v16h-88c-22.091 0-40 17.909-40 40v32c0 8.837 7.163 16 16 16h384c8.837 0 16-7.163 16-16v-32c0-22.091-17.909-40-40-40zm-216-16c0-8.82 7.18-16 16-16h64c8.82 0 16 7.18 16 16v16h-96z"/>
                <path d="m78.364 184c-2.855 0-5.13 2.386-4.994 5.238l13.2 277.042c1.22 25.64 22.28 45.72 47.94 45.72h242.98c25.66 0 46.72-20.08 47.94-45.72l13.2-277.042c.136-2.852-2.139-5.238-4.994-5.238zm241.636 40c0-8.84 7.16-16 16-16s16 7.16 16 16v208c0 8.84-7.16 16-16 16s-16-7.16-16-16zm-80 0c0-8.84 7.16-16 16-16s16 7.16 16 16v208c0 8.84-7.16 16-16 16s-16-7.16-16-16zm-80 0c0-8.84 7.16-16 16-16s16 7.16 16 16v208c0 8.84-7.16 16-16 16s-16-7.16-16-16z"/>
            </g>
          </svg>
        </div>
      </div>
    </div>
  )

}

export default Editor;
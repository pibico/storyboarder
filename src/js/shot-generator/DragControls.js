const THREE = require('three')
// const { selectObject, updateObject } = require('../state')

const BonesHelper = require('./BonesHelper')
const BoundingBoxHelper = require('./BoundingBoxHelper')

class DragControls extends THREE.EventDispatcher {

  constructor ( objects, camera, domElement, onSelectObject, onUpdateObject, onSelectBone ) {
    super()

    console.log('i am a drag controller')

    this.onSelectObject = onSelectObject
    this.onUpdateObject = onUpdateObject
    this.onSelectBone = onSelectBone

    // this._editor = editor
    this._objects = objects
    this._bonesHelper = null
    this._camera = camera
    this._domElement = domElement

    this._plane = new THREE.Plane()
    this._raycaster = new THREE.Raycaster()

    this._mouse = new THREE.Vector2()
    this._offset = new THREE.Vector3()
    this._intersection = new THREE.Vector3()

    this._selected = null
    this._hovered = null
    this._downTarget = null

    this.enabled = true

    this.activate()
  }

  activate () {
    this._domElement.addEventListener( 'pointermove', this.onPointerMove.bind(this), false )
    this._domElement.addEventListener( 'pointerdown', this.onPointerDown.bind(this), false )
    this._domElement.addEventListener( 'pointerup', this.onPointerUp.bind(this), false )
    // this._domElement.addEventListener( 'pointerleave', onDocumentMouseCancel, false )
  }

  deactivate() {
    this._domElement.removeEventListener( 'pointermove', onPointerMove, false )
    this._domElement.removeEventListener( 'pointerdown', onPointerDown, false )
    this._domElement.removeEventListener( 'pointerup', onPointerUp, false )
    // this._domElement.removeEventListener( 'pointerleave', onDocumentMouseCancel, false )
  }

  _updateMouse ( event ) {
    let rect = this._domElement.getBoundingClientRect()
    this._mouse.x = ( ( event.clientX - rect.left ) / rect.width ) * 2 - 1
    this._mouse.y = - ( ( event.clientY - rect.top ) / rect.height ) * 2 + 1
  }

  onPointerMove ( event ) {
    event.preventDefault()
    this._updateMouse( event )

    this._raycaster.setFromCamera( this._mouse, this._camera )

    if ( this._dragTarget && this.enabled ) {
      //console.log('this._dragTarget', this._dragTarget, 'this.enabled', this.enabled)
      // console.log("selected")
      if ( this._raycaster.ray.intersectPlane( this._plane, this._intersection ) ) {

        // console.log(this._offset)
        let pos = this._intersection.sub( this._offset )
        pos.y = 0
        //console.log(this._intersection.sub( this._offset ))
        // this._selected.position.copy( pos )

        console.log('updating')
        this.onUpdateObject(this._dragTarget.userData.id, { x: pos.x, y: pos.z /*, z: pos.y*/ })
      }

      this.dispatchEvent( { type: 'drag', object: this._dragTarget } )
      return
    }

    // this._raycaster.setFromCamera( this._mouse, this._camera )
    // let intersects = this._raycaster.intersectObjects( this._objects.map(x => x.object) )

    // if ( intersects.length > 0 ) {
    //   let object = intersects[ 0 ].object
    //   this._plane.setFromNormalAndCoplanarPoint( this._camera.getWorldDirection( this._plane.normal ), object.position )

    //   if ( this._hovered !== object ) {
    //     this.dispatchEvent( { type: 'hoveron', object: object } )
    //     this._domElement.style.cursor = 'pointer'
    //     this._hovered = object
    //   }
    // } else {
    //   if ( this._hovered !== null ) {
    //     this.dispatchEvent( { type: 'hoveroff', object: this._hovered } )
    //     this._domElement.style.cursor = 'auto'
    //     this._hovered = null
    //   }
    // }
  }

  getObjectAndBone ( intersect ) {
    if (intersect.object instanceof THREE.Mesh && intersect.object.userData.type === 'hitter' )
    {
      let obj = intersect.object.parent.object3D
      return [obj, null]
    }

    if (intersect.object instanceof BoundingBoxHelper) {
      return [intersect.object.object, null]
    }

    let isBone = intersect.object.parent instanceof BonesHelper

    let object = isBone
      ? intersect.object.parent.root.parent
      : intersect.object

    let bone = isBone
      // object.parent.root.parent.skeleton.bones
      //   .find(b => b.uuid === o.object.userData.bone)
      ? intersect.bone
      : null

    return [object, bone]
  }

  onPointerDown ( event ) {
    event.preventDefault()
    this._raycaster.setFromCamera( this._mouse, this._camera )

    let shouldReportSelection = false
    let checkIntersectionsWithMeshes = []
    for (var o of this._objects)
    {
      if (o instanceof THREE.Mesh) checkIntersectionsWithMeshes.push(o)
      if (o instanceof THREE.Object3D && o.userData.type === 'character')
      {
        checkIntersectionsWithMeshes = checkIntersectionsWithMeshes.concat(o.bonesHelper.hit_meshes)
      }
    }
    let intersects = this._raycaster.intersectObjects( checkIntersectionsWithMeshes )
    //console.log('hits: ', intersects)
    if ( intersects.length > 0 ) {
      this.onSelectBone( null )  // deselect bone is any selected 
      let object = this.getObjectAndBone( intersects[ 0 ] )[0]
      if (
        // is the camera is orthographic (which means, start dragging on the first click)
        this._camera.isOrthographicCamera
      ) {
        this._selected = object
        this._downTarget = object
        shouldReportSelection = true
      }

        // if we already have a selection and this object matches it ("double-click")
      if (this._selected === object) {

        // is the BonesHelper being selected?
        let hits
        let bone
        if (this._bonesHelper) {
          hits = this._raycaster.intersectObject( this._bonesHelper )
          bone = hits.length && this.getObjectAndBone( hits[ 0 ] )[1]
        }

        // ... select bone (if any) ...
        if (this._camera.isPerspectiveCamera) {
          if (bone) {

            this.onSelectBone( bone.uuid )
          } else {
            this.onSelectBone( null )
          }
        }

        // ... and then we want to start dragging that selected object
        this._dragTarget = this._selected

        this._domElement.style.cursor = 'move'

        if (this._camera.isOrthographicCamera) {
          this._plane.setFromNormalAndCoplanarPoint( this._camera.position.clone().normalize(), object.position )
        } else {
          this._plane.setFromNormalAndCoplanarPoint( this._camera.getWorldDirection( this._plane.normal ), object.position )
        }

        if ( this._raycaster.ray.intersectPlane( this._plane, this._intersection ) ) {
          this._offset.copy( this._intersection ).sub( this._selected.position )
        }

        //console.log( 'drag start!', this._dragTarget )

        if (shouldReportSelection) {
          this.onSelectObject( this._selected.userData.id )
        }
        this.dispatchEvent( { type: 'dragstart', object: this._dragTarget } )

      } else {
        // otherwise, we just want to select
        this._downTarget = object
      }

    } else {
      this._downTarget = null

      let selectionId = this._selected && this._selected.userData.id
      let activeCameraId = this._camera && this._camera.userData.id
      let currentSelectionIsActiveCamera = (
        selectionId != null &&
        activeCameraId === selectionId
      )
      if (!currentSelectionIsActiveCamera) {
        this._selected = null
        this.onSelectObject(activeCameraId)
      }

      this.onSelectBone(null)
    }
  }

  onPointerUp ( event ) {
    event.preventDefault()

    this._raycaster.setFromCamera( this._mouse, this._camera )

    let checkIntersectionsWithMeshes = []
    for (var o of this._objects)
    {
      if (o instanceof THREE.Mesh) checkIntersectionsWithMeshes.push(o)
      if (o instanceof THREE.Object3D && o.userData.type === 'character')
      {
        checkIntersectionsWithMeshes = checkIntersectionsWithMeshes.concat(o.bonesHelper.hit_meshes)
      }
    }
    let intersects = this._raycaster.intersectObjects( checkIntersectionsWithMeshes )

    let object
    let bone
    if ( intersects.length > 0 ) {
      [object, bone] = this.getObjectAndBone( intersects[ 0 ] )
    }

    // if we're dragging
    if (this._dragTarget) {
      //console.log('drag end!')
      this.dispatchEvent( { type: 'dragend', object: this._dragTarget } )
      this._dragTarget = null

      this._domElement.style.cursor = 'auto' // this._hovered ? 'pointer' : 'auto'

    // otherwise, if we match the object from mousedown
  } else if ( object && this._downTarget === object ) {
      this._selected = this._downTarget
      this.onSelectObject( this._selected.userData.id )
    }
  }

  setCamera ( camera ) {
    this._camera = camera
  }

  setObjects ( objects ) {
    this._objects = objects
  }

  setBones ( helper ) {
    this._bonesHelper = helper
  }

  setSelected ( object ) {
    this._selected = object
  }
}

module.exports = DragControls

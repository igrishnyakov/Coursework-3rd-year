import { Route, Routes } from 'react-router-dom'
import Main from './pages/Main'
import SandBox from './pages/SandBox'
import CrudExample from './pages/CrudExample'

function Content(props) {
    return (
        <>
            <div className='content-wrapper'>
                <div className='content'>
                    <Routes>
                        <Route path='/' element={<Main />} />
                        <Route path='/sandbox' element={<SandBox />} />
                        <Route path='/crud-example' element={<CrudExample currentUserInfo={props.currentUserInfo} />} />
                    </Routes>
                </div>
            </div>
        </>
    )
}

export default Content